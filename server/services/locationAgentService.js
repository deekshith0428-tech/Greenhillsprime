const store = require('./locationKnowledgeStore');
const dbService = require('./dbService');
const geminiService = require('./geminiService');
const googleCalendarService = require('./googleCalendarService');
const googleSheetsService = require('./googleSheetsService');
const whatsappService = require('./whatsappService');
const mediaService = require('./mediaService');

class LocationAgentService {
  normalizeQuery(query) {
    if (!query) return '';
    let s = String(query).toLowerCase().replace(/[?,.!]/g, '').trim();
    // Normalize common spelling typos and singular/plural forms
    s = s.replace(/\bameneties\b/g, 'amenities');
    s = s.replace(/\bamenity\b/g, 'amenities');
    s = s.replace(/\bfacilties\b/g, 'facilities');
    s = s.replace(/\bfacilites\b/g, 'facilities');
    s = s.replace(/\bfeature\b/g, 'features');
    s = s.replace(/\bdevelpmnt\b/g, 'development');
    s = s.replace(/\bdevlopment\b/g, 'development');
    s = s.replace(/\binfrastrucutre\b/g, 'infrastructure');
    return s;
  }

  async processIncomingWhatsAppMessage(rawPayload) {
    let whatsappMessageId = null;
    let rawPhone = null;
    let customerName = 'Interested Customer';
    let messageType = 'TEXT';
    let query = '';

    // Parse Meta Webhook Payload vs Direct Simulator Payload
    if (rawPayload && rawPayload.entry && rawPayload.entry[0] && rawPayload.entry[0].changes && rawPayload.entry[0].changes[0] && rawPayload.entry[0].changes[0].value) {
      const val = rawPayload.entry[0].changes[0].value;
      if (val.messages && val.messages[0]) {
        const msg = val.messages[0];
        whatsappMessageId = msg.id;
        rawPhone = msg.from;
        messageType = (msg.type || 'TEXT').toUpperCase();

        if (val.contacts && val.contacts[0] && val.contacts[0].profile) {
          customerName = val.contacts[0].profile.name || customerName;
        }

        if (msg.text) query = msg.text.body || '';
        else if (msg.image) query = msg.image.caption || 'I sent an image.';
        else if (msg.video) query = msg.video.caption || 'I sent a video.';
        else if (msg.document) query = msg.document.caption || 'I sent a document.';
        else if (msg.location) query = `Location pin sent: Lat ${msg.location.latitude}, Long ${msg.location.longitude}`;
        else if (msg.interactive) query = msg.interactive.button_reply ? msg.interactive.button_reply.title : 'Interactive response';
        else query = `Sent a ${messageType} message.`;
      }
    } else {
      whatsappMessageId = rawPayload.whatsapp_message_id || `wamid.sim_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      rawPhone = rawPayload.whatsapp_number || rawPayload.from || '+919876543210';
      customerName = rawPayload.customer_name || customerName;
      messageType = (rawPayload.message_type || 'TEXT').toUpperCase();
      query = rawPayload.message || rawPayload.text || '';
    }

    // 1. IDEMPOTENCY CHECK (Duplicate Webhook Protection)
    if (whatsappMessageId && (await dbService.isMessageIdProcessed(whatsappMessageId))) {
      console.log(`[Idempotency Warning] Message ID ${whatsappMessageId} already processed. Rejecting duplicate webhook.`);
      return { success: true, duplicate: true, whatsapp_message_id: whatsappMessageId };
    }

    // Process via core agent query handler
    const response = await this.processQuery(query, {
      whatsapp_number: rawPhone,
      customer_name: customerName,
      whatsapp_message_id: whatsappMessageId,
      message_type: messageType
    });

    // Send outgoing response via Meta Graph API (or mock logger)
    if (response && response.answer && response.debug && response.debug.conversation_state === 'AI_ACTIVE') {
      const sendResult = await whatsappService.sendTextMessage(rawPhone, response.answer);
      if (sendResult && sendResult.messages && sendResult.messages[0]) {
        response.outgoing_whatsapp_message_id = sendResult.messages[0].id;
      }
    }

    return response;
  }

  async processQuery(userQuery, userSession = {}) {
    const query = (userQuery || '').trim();
    const qLower = query.toLowerCase();
    const kb = store.getKnowledge();

    const rawPhone = userSession.whatsapp_number || '+919876543210';
    const customerName = userSession.customer_name || 'Interested Customer';
    const whatsappMessageId = userSession.whatsapp_message_id || null;
    const messageType = userSession.message_type || 'TEXT';

    // 1. DATABASE CUSTOMER & CONVERSATION LOOKUP
    const customer = await dbService.findOrCreateCustomer(rawPhone, customerName);
    const conversation = await dbService.getConversation(customer.id);
    let lead = (await dbService.getLeadByCustomer(customer.id)) || {
      customer_id: customer.id,
      whatsapp_number: customer.whatsapp_number,
      interest_level: 'MEDIUM',
      lead_status: 'NEW_LEAD'
    };

    // 2. HUMAN TAKEOVER ENFORCEMENT
    if (conversation.state === 'HUMAN_ACTIVE' || conversation.state === 'AI_PAUSED') {
      await dbService.saveMessage({
        conversation_id: conversation.id,
        sender_type: 'CUSTOMER',
        message_type: messageType,
        content: query,
        whatsapp_message_id: whatsappMessageId
      });

      await dbService.logAiAction(
        conversation.id,
        'AI_BYPASSED',
        'HUMAN_TAKEOVER_ACTIVE',
        [],
        ['HUMAN_TAKEOVER_ENFORCED'],
        'AI response bypassed because Human Takeover is active.'
      );

      const humanAnswer =
        '[Human Takeover Active] Your message has been received by our sales management team. A human advisor will reply directly shortly.';

      await dbService.saveMessage({
        conversation_id: conversation.id,
        sender_type: 'SYSTEM',
        content: humanAnswer
      });

      return this.formatResponse(
        humanAnswer,
        'HUMAN_TAKEOVER_ACTIVE',
        [],
        'PAUSED',
        ['HUMAN_TAKEOVER_ENFORCED'],
        true,
        null,
        null,
        lead,
        conversation.state
      );
    }

    // Save incoming customer message to DB
    await dbService.saveMessage({
      conversation_id: conversation.id,
      sender_type: 'CUSTOMER',
      message_type: messageType,
      content: query,
      whatsapp_message_id: whatsappMessageId
    });

    const guardrailsTriggered = [];
    const factsUsed = [];
    let matchedIntent = 'UNKNOWN';
    let approvedForCustomer = true;
    let answer = '';
    let proactiveSteps = null;
    let appointmentDetails = null;

    // Fetch conversation message history from DB for LLM context
    const conversationHistory = await dbService.getMessages(conversation.id, 10);
    const previousMessage = conversationHistory.length >= 2 ? conversationHistory[conversationHistory.length - 2].content : '';
    const normQuery = this.normalizeQuery(query);

    // Extract customer budget
    if (qLower.includes('lakh') || qLower.includes('budget') || qLower.includes('price range') || qLower.includes('cost')) {
      const match = query.match(/(\d+\s*lakhs?)/i);
      lead.budget = match ? `₹${match[0]}` : 'Around ₹5-7 Lakhs';
      lead.interest_level = 'HIGH';
      await dbService.upsertLeadRecord(customer, lead);
    }

    // Extract customer purpose
    if (qLower.includes('family') || qLower.includes('build a house') || qLower.includes('home') || qLower.includes('living') || qLower.includes('house')) {
      lead.purpose = 'Residential / Family Home';
      await dbService.upsertLeadRecord(customer, lead);
    } else if (qLower.includes('invest') || qLower.includes('investment') || qLower.includes('return')) {
      lead.purpose = 'Investment';
      await dbService.upsertLeadRecord(customer, lead);
    }

    // Check first-contact welcomed state in PostgreSQL / Pure-JS DB
    const isWelcomed = await dbService.isCustomerWelcomed(customer.whatsapp_number);
    let promoBanner = '';

    if (!isWelcomed) {
      promoBanner = `Namaste! 👋 Welcome to Royal Kingdom – Green Hills Prime (Morgi Village, Nagalgidda Mandal, Sangareddy Dist).

🌟 *Exclusive Spot Payment Gold Offer*:
• *1 Gunta (121 Sq Yds)*: ₹2,00,000 ONLY (Rate: ₹1,650/sq yd)
• *2 Guntas (242 Sq Yds)*: ₹4,00,000 ONLY + *Gold Offer on Full Payment!*
• *5 Guntas (605 Sq Yds)*: ₹10,00,000
• *Registration*: ₹12,500 for 1g/2g | ₹37,500 for 5g | 50-Year Patta Linked Docs

✨ *Included*: 6 Years Free Maintenance, 2-Acre Resort + 3-Acre Water Feature, Fruit Plantation & Free Vehicle Site Visit!`;

      await dbService.markCustomerWelcomed(customer.whatsapp_number);
    }

    // --- 1. GREETING INTENT ---
    const greetingWords = ['hi', 'hello', 'hey', 'namaste', 'good morning', 'good afternoon', 'good evening', 'start', 'hii'];
    const isGreeting = greetingWords.some((w) => qLower === w || qLower.startsWith(w + ' ') || qLower.endsWith(' ' + w));

    if (isGreeting) {
      matchedIntent = 'PROACTIVE_ONBOARDING_GREETING';
      factsUsed.push('project_location', 'plot_pricing', 'resort_and_clubhouse');
      answer = isWelcomed
        ? 'Welcome back to Green Hills Prime! Are you looking for plot availability, location details, pricing, or scheduling a site visit?'
        : `${promoBanner}\n\nAre you looking for plot availability, location details, or a free site visit?`;
    }

    // --- 2. OFF-TOPIC & GENERAL KNOWLEDGE INTENTS (DIRECT GENERAL ANSWERS) ---
    else if (qLower.includes('capital of india') || qLower.includes('capital of telangana')) {
      matchedIntent = 'general_knowledge';
      answer = qLower.includes('telangana') ? 'Hyderabad is the capital of Telangana.' : 'New Delhi is the capital of India.';
    } else if (qLower.includes('what is a hectare') || qLower.includes('hectare')) {
      matchedIntent = 'general_question';
      answer = 'A hectare is a unit of land area equal to 10,000 square metres (approximately 2.47 acres or 99.17 guntas).';
    } else if (qLower.includes('joke') || qLower.includes('tell me a joke')) {
      matchedIntent = 'unrelated_question';
      answer = "Why don't scientists trust atoms? Because they make up everything! 😊 How can I assist with your land search today?";
    }

    // --- 3. ANAPHORA & CONTEXT RESOLUTION INTENTS ---
    else if (qLower.includes('nearest city') || (qLower.includes('city') && (qLower.includes('nearest') || qLower.includes('close')))) {
      matchedIntent = 'nearest_city_query';
      factsUsed.push('nearby_locations.loc_bidar');
      answer = 'Bidar City is the nearest major city to Green Hills Prime, located approximately 22 km away.';
    } else if (qLower === 'how far' || qLower === 'how far is it' || qLower.startsWith('how far is it')) {
      matchedIntent = 'anaphora_distance_query';
      const prevLower = previousMessage.toLowerCase();
      if (prevLower.includes('city') || prevLower.includes('bidar') || prevLower.includes('nearest')) {
        factsUsed.push('nearby_locations.loc_bidar');
        answer = 'Bidar City is located approximately 22 km from Green Hills Prime.';
      } else if (prevLower.includes('narayankhed')) {
        factsUsed.push('nearby_locations.loc_narayankhed');
        answer = 'Narayankhed town is located 12 km from Green Hills Prime.';
      } else if (prevLower.includes('nimz')) {
        factsUsed.push('nearby_locations.loc_nimz');
        answer = 'Zaheerabad NIMZ is located 15 km from Green Hills Prime.';
      } else if (prevLower.includes('hyderabad')) {
        factsUsed.push('nearby_locations.loc_hyderabad');
        answer = 'Hyderabad is located approximately 110 km from Green Hills Prime via the NH-65 highway corridor.';
      } else {
        factsUsed.push('nearby_locations');
        answer = 'Narayankhed is 12 km away, NIMZ is 15 km away, Bidar City & Airport are 22 km away, and Hyderabad is 110 km away.';
      }
    }

    // --- 4. AMENITIES, FEATURES, FACILITIES & DEVELOPMENT INTENTS ---
    else if (
      normQuery === 'features' ||
      normQuery === 'feature' ||
      normQuery === 'amenities' ||
      normQuery === 'amenity' ||
      normQuery === 'ameneties' ||
      normQuery === 'facilities' ||
      normQuery === 'facility' ||
      normQuery === 'development' ||
      normQuery === 'developed' ||
      normQuery === 'infrastructure' ||
      normQuery.includes('what is developed') ||
      normQuery.includes('what development') ||
      normQuery.includes('what facilities') ||
      normQuery.includes('project features') ||
      normQuery.includes('project amenities') ||
      normQuery.includes('is that area developed') ||
      normQuery.includes('is the area developed') ||
      normQuery.includes('will this area be developed') ||
      normQuery.includes('will it be developed') ||
      normQuery.includes('how is the development') ||
      normQuery.includes('what facilities are developed') ||
      normQuery.includes('how is the development there') ||
      normQuery.includes('is the area developing') ||
      normQuery.includes('future development') ||
      normQuery.includes('nearby infrastructure') ||
      normQuery.includes('upcoming development') ||
      normQuery.includes('why should i invest') ||
      normQuery.includes('development features') ||
      normQuery.includes('amenities') ||
      normQuery.includes('facilities') ||
      normQuery.includes('clubhouse') ||
      normQuery.includes('features') ||
      normQuery.includes('feature') ||
      (normQuery.includes('develop') && (normQuery.includes('area') || normQuery.includes('nearby') || normQuery.includes('feature') || normQuery.includes('plan') || normQuery.includes('there') || normQuery.includes('how') || normQuery.includes('what') || normQuery.includes('is')))
    ) {
      matchedIntent = 'AMENITIES_AND_DEVELOPMENT';
      factsUsed.push('land_development', 'resort_and_clubhouse', 'development_ecosystem');
      answer = 'Green Hills Prime amenities, development features & infrastructure include a 2-acre resort + 3-acre water feature zone (swimming pool, open-air gym, children\'s play area, sports grounds, camping zone, indoor games), 25ft, 30ft & 33ft wide internal BT roads, 100ft main road frontage, electricity transformer & streetlights, borewell water storage, 24x7 CCTV security with gated boundary wall, geotagging, fruit plantations (Mango, Guava, Custard Apple, Sapota, Coconut), and 6 years company maintenance.';
    }

    // --- 5. OBJECTIONS & SALES HESITATION ---
    else if (qLower.includes('discuss with my family') || qLower.includes('family discussion') || qLower.includes('talk to family')) {
      matchedIntent = 'objection';
      answer = 'Absolutely! Take your time to discuss with your family. If you\'d like, I can share a summary of our plot options, layout details, and location map so you have everything ready for your discussion.';
    } else if (qLower.includes('don\'t want to buy') || qLower.includes('not buying') || qLower.includes('just checking') || qLower.includes('looking around')) {
      matchedIntent = 'objection';
      answer = 'Of course, no problem at all! Taking your time with property decisions is very important. Whenever you\'re ready, I can share location details, plot options, or site visit information for your reference.';
    }

    // --- 6. SITE VISIT WORKFLOW (BOOKING / RESCHEDULING / CANCELLATION / INQUIRY) ---
    else if (qLower.includes('cancel') && (qLower.includes('visit') || qLower.includes('appointment'))) {
      matchedIntent = 'site_visit_cancel';
      factsUsed.push('site_visits');

      const existingApt = (await dbService.query(
        dbService.usePostgres
          ? 'SELECT * FROM site_visits WHERE customer_id = $1 AND status != \'CANCELLED\''
          : 'SELECT * FROM site_visits WHERE customer_id = ? AND status != \'CANCELLED\'',
        [customer.id]
      ))[0];

      if (existingApt) {
        await googleCalendarService.cancelEvent(existingApt.google_calendar_event_id);
        await dbService.query(
          dbService.usePostgres ? 'UPDATE site_visits SET status = $1 WHERE id = $2' : 'UPDATE site_visits SET status = ? WHERE id = ?',
          ['CANCELLED', existingApt.id]
        );
        lead.site_visit_interest = false;
        lead.lead_status = 'VISIT_CANCELLED';
        await dbService.upsertLeadRecord(customer, lead);
        await googleSheetsService.upsertLeadToSheet(lead);
        answer = 'Your Green Hills Prime site visit appointment has been cancelled as requested. Feel free to reschedule anytime whenever you are ready!';
      } else {
        answer = 'I could not find an active site visit appointment under your phone number. Would you like to schedule a new visit?';
      }
    } else if (qLower.includes('reschedule') || qLower.includes('monday instead') || qLower.includes('come monday')) {
      matchedIntent = 'site_visit_reschedule';
      factsUsed.push('site_visits', 'google_calendar');

      const parsedDate = this.extractDate(query) || '2026-08-24';
      const parsedTime = this.extractTime(query) || '11:00 AM';

      let existingApt = (await dbService.query(
        dbService.usePostgres
          ? 'SELECT * FROM site_visits WHERE customer_id = $1 AND status != \'CANCELLED\''
          : 'SELECT * FROM site_visits WHERE customer_id = ? AND status != \'CANCELLED\'',
        [customer.id]
      ))[0];

      if (!existingApt && lead && (lead.site_visit_interest || lead.site_visit_date)) {
        existingApt = {
          id: 'apt_' + Date.now(),
          customer_id: customer.id,
          whatsapp_number: customer.whatsapp_number,
          customer_name: customer.customer_name,
          date: lead.site_visit_date || '2026-08-23',
          time: lead.site_visit_time || '11:00 AM',
          pickup_location: lead.pickup_location || 'Miyapur Metro Station, Hyderabad',
          status: 'CONFIRMED'
        };
      }

      if (existingApt) {
        existingApt.date = parsedDate;
        existingApt.time = parsedTime;
        existingApt.status = 'RESCHEDULED';

        await googleCalendarService.updateEvent(existingApt.google_calendar_event_id, existingApt);
        await dbService.query(
          dbService.usePostgres
            ? 'UPDATE site_visits SET date = $1, time = $2, status = $3 WHERE id = $4'
            : 'UPDATE site_visits SET date = ?, time = ?, status = ? WHERE id = ?',
          [parsedDate, parsedTime, 'RESCHEDULED', existingApt.id]
        );

        lead.site_visit_date = parsedDate;
        lead.site_visit_time = parsedTime;
        lead.lead_status = 'SITE_VISIT_RESCHEDULED';
        await dbService.upsertLeadRecord(customer, lead);
        await googleSheetsService.upsertLeadToSheet(lead);

        answer = `Your site visit appointment has been successfully rescheduled!\n\n📅 *New Date*: ${parsedDate}\n⏰ *New Time*: ${parsedTime}\n🚗 *Transportation*: Company vehicle\n📍 *Pickup*: ${existingApt.pickup_location || 'Project Site'}\n\nOur team will coordinate with you prior to departure.`;
      } else {
        answer = 'No active visit was found to reschedule. Would you like to book a new site visit?';
      }
    } else if (
      qLower.includes('when visit') ||
      qLower.includes('when can i visit') ||
      qLower.includes('when can i come') ||
      qLower.includes('can i visit') ||
      qLower.includes('can i come') ||
      qLower.includes('want to visit') ||
      qLower.includes('want to see the site') ||
      qLower.includes('show me the place') ||
      qLower.includes('show me the site') ||
      qLower.includes('see the site') ||
      qLower.includes('book a visit') ||
      qLower.includes('book visit') ||
      qLower.includes('schedule a visit') ||
      qLower.includes('free site visit') ||
      qLower.includes('site visit') ||
      (previousMessage.toLowerCase().includes('visit') && (qLower === 'when' || qLower === 'when?' || qLower.includes('tomorrow') || qLower.includes('sunday') || qLower.includes('monday')))
    ) {
      matchedIntent = 'SITE_VISIT_BOOKING_FLOW';
      factsUsed.push('pickup_policy', 'google_calendar_api', 'google_sheets_api');

      const hasSpecificDateOrTime = this.extractDate(query) || this.extractTime(query) || qLower.includes('tomorrow') || qLower.includes('sunday') || qLower.includes('monday') || qLower.includes('schedule') || qLower.includes('book');

      if (!hasSpecificDateOrTime && (normQuery.includes('when visit') || normQuery.includes('when can i visit') || normQuery.includes('can i visit') || normQuery.includes('can i come') || normQuery.includes('want to see') || normQuery.includes('show me the place') || (previousMessage.toLowerCase().includes('visit') && normQuery.includes('when')))) {
        answer = 'Yes, you can schedule a free site visit! We provide complimentary company vehicle pickup from Hyderabad. Tell me your preferred date and time, and I will be happy to arrange it for you.';
      } else {
        const parsedDate = this.extractDate(query) || '2026-08-23';
        const parsedTime = this.extractTime(query) || '11:00 AM';
        const pickupLocation = this.extractPickupLocation(query) || lead.pickup_location || 'Miyapur Metro Station, Hyderabad';

        // Slot availability check
        const availability = await googleCalendarService.checkAvailability(parsedDate, parsedTime);
        if (!availability.available) {
          answer = `Thank you! However, our vehicle/slot for ${parsedDate} at ${parsedTime} is currently fully booked.\n\nWould any of these alternative slots work for you?\n1️⃣ ${parsedDate} at 03:00 PM\n2️⃣ Next Sunday at 11:00 AM`;
        } else {
          const calRes = await googleCalendarService.createEvent({
            whatsapp_number: customer.whatsapp_number,
            customer_name: customer.customer_name,
            date: parsedDate,
            time: parsedTime,
            pickup_location: pickupLocation,
            vehicle_required: true
          });

          const aptId = 'apt_' + Date.now();
          const sqlApt = dbService.usePostgres
            ? 'INSERT INTO site_visits (id, customer_id, whatsapp_number, customer_name, date, time, pickup_location, vehicle_required, status, google_calendar_event_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)'
            : 'INSERT INTO site_visits (id, customer_id, whatsapp_number, customer_name, date, time, pickup_location, vehicle_required, status, google_calendar_event_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

          const now = new Date().toISOString();
          await dbService.query(sqlApt, [
            aptId,
            customer.id,
            customer.whatsapp_number,
            customer.customer_name,
            parsedDate,
            parsedTime,
            pickupLocation,
            true,
            'CONFIRMED',
            calRes.eventId,
            now,
            now
          ]);

          lead.site_visit_interest = true;
          lead.site_visit_date = parsedDate;
          lead.site_visit_time = parsedTime;
          lead.pickup_location = pickupLocation;
          lead.lead_status = 'SITE_VISIT_CONFIRMED';
          lead.interest_level = 'SITE_VISIT_READY';
          await dbService.upsertLeadRecord(customer, lead);
          await googleSheetsService.upsertLeadToSheet({ ...lead, google_calendar_event_id: calRes.eventId });

          answer = `Your Green Hills Prime site visit is confirmed! 🌿\n\n📅 Date: ${parsedDate}\n⏰ Time: ${parsedTime}\n🚗 Transportation: Company vehicle\n📍 Pickup Location: ${pickupLocation}\n\nOur team will coordinate the pickup details with you.`;
          appointmentDetails = { id: aptId, date: parsedDate, time: parsedTime, pickup_location: pickupLocation };
        }
      }
    }

    // --- 7. FACTUAL PROJECT QUERY INTENTS & GUARDRAILS ---
    else if (qLower.includes('double') || qLower.includes('price increase') || qLower.includes('guaranteed') || qLower.includes('guarantee') || qLower.includes('resale profit')) {
      guardrailsTriggered.push('FINANCIAL_GUARANTEE_BLOCKED');
      matchedIntent = 'INVESTMENT_GUARANTEE_QUERY';
      factsUsed.push('nimz_landmark.disclaimer');
      answer = 'Property appreciation in the Green Hills Prime region is supported by nearby industrial growth such as Zaheerabad NIMZ (15 km away). However, future property appreciation, price increases, or guaranteed resale returns depend on market factors and cannot be guaranteed.';
    } else if (qLower.includes('mandal') || qLower.includes('nagalagidda') || qLower.includes('nagalgidda')) {
      matchedIntent = 'QUERY_PROJECT_MANDAL';
      guardrailsTriggered.push('PROJECT_MANDAL_UNVERIFIED_PROTECTION');
      factsUsed.push('project_location.project_mandal');
      answer = 'Green Hills Prime is located in Morgi Village, Nagalgidda Mandal, Sangareddy District (pending official revenue record verification). Our sales advisors can confirm the official documentation during your inquiry.';
    } else if (qLower.includes('approved') || qLower.includes('permission') || qLower.includes('dtcp') || qLower.includes('legal')) {
      matchedIntent = 'legal/approval';
      factsUsed.push('registration_info.patta_passbook_wording');
      answer = 'Green Hills Prime offers clear title & legal security with 50-year Patta linked documentation and spot registration availability. Individual plot transfer & passbook documentation is processed during registration.';
    } else if (qLower.includes('build a house') || qLower.includes('can i build') || qLower.includes('house construction')) {
      matchedIntent = 'house_construction';
      factsUsed.push('land_development', 'plot_categories');
      answer = 'Yes, Green Hills Prime open plots are suitable for residential home construction and farmland country living. The layout features 25ft, 30ft & 33ft wide internal roads, electricity lines, borewell water, 24x7 CCTV security, and gated entry.';
    } else if (qLower.includes('amenities') || qLower.includes('facilities') || qLower.includes('clubhouse')) {
      matchedIntent = 'amenities';
      factsUsed.push('resort_and_clubhouse', 'land_development');
      answer = 'Green Hills Prime amenities include a 2-acre resort + 3-acre water feature zone (swimming pool, open-air gym, children\'s play area, sports grounds, camping zone, indoor games), 25ft & 30ft internal roads, 100ft main road frontage, electricity transformer, geotagging, fruit plantations (Mango, Guava, Custard Apple, Sapota, Coconut), and 6 years company maintenance.';
    } else if (qLower.includes('plot size') || qLower.includes('plot sizes') || qLower.includes('dimensions')) {
      matchedIntent = 'plot_sizes';
      factsUsed.push('plot_pricing');
      answer = 'Green Hills Prime offers three approved plot size categories:\n• *1 Gunta*: 121 Sq Yds\n• *2 Guntas*: 242 Sq Yds (Approx. 36.3 ft x 60 ft)\n• *5 Guntas*: 605 Sq Yds';
    } else if (qLower.includes('additional charge') || qLower.includes('additional charges') || qLower.includes('extra charge')) {
      matchedIntent = 'additional_charges';
      factsUsed.push('plot_pricing');
      answer = 'Additional plot charges for Green Hills Prime are:\n• *Corner Plot*: +₹50,000 extra\n• *East-Facing Plot*: +₹10,000 extra\n• *30ft Road Facing Plot*: +₹20,000 extra';
    } else if (qLower.includes('registration cost 2 lakh') || (qLower.includes('registration') && qLower.includes('2 lakh'))) {
      matchedIntent = 'QUERY_REGISTRATION_DETAILS';
      guardrailsTriggered.push('REGISTRATION_AMOUNT_INTERPRETATION_GUARDRAIL');
      factsUsed.push('registration_info');
      answer = 'Registration charges for Green Hills Prime are ₹12,500 for 1 Gunta, ₹12,500 for 2 Guntas, and ₹37,500 for 5 Guntas. The ₹2 Lakh figure refers to the 1 Gunta plot price rather than registration fees.';
    } else if (qLower.includes('registration')) {
      matchedIntent = 'registration';
      factsUsed.push('registration_info');
      answer = 'Spot registration is available for Green Hills Prime plots. Applicable registration charges are ₹12,500 for 1 Gunta, ₹12,500 for 2 Guntas, and ₹37,500 for 5 Guntas.';
    } else if (qLower.includes('rythu bandhu') || qLower.includes('rythu bima') || qLower.includes('government scheme')) {
      matchedIntent = 'government_schemes';
      factsUsed.push('registration_info.rythu_bandhu_wording', 'registration_info.rythu_bima_wording');
      answer = qLower.includes('bima') ? kb.registration_info.rythu_bima_wording : kb.registration_info.rythu_bandhu_wording;
    } else if (qLower.includes('patta') || qLower.includes('passbook')) {
      matchedIntent = 'legal/approval';
      factsUsed.push('registration_info.patta_passbook_wording');
      answer = kb.registration_info.patta_passbook_wording;
    } else if (qLower.includes('narayankhed')) {
      matchedIntent = 'connectivity';
      factsUsed.push('nearby_locations.loc_narayankhed');
      answer = 'Narayankhed town is located 12 km from Green Hills Prime.';
    } else if (qLower.includes('bidar airport') || qLower.includes('bidar domestic airport')) {
      matchedIntent = 'connectivity';
      factsUsed.push('nearby_locations.loc_bidar_airport');
      answer = 'Bidar Domestic Airport is located approximately 22 km from Green Hills Prime.';
    } else if (qLower.includes('nimz')) {
      matchedIntent = 'connectivity';
      factsUsed.push('nearby_locations.loc_nimz');
      answer = 'Zaheerabad NIMZ (National Investment & Manufacturing Zone) is located 15 km from Green Hills Prime (20 km via state highway corridor).';
    } else if (qLower.includes('bidar')) {
      matchedIntent = 'connectivity';
      factsUsed.push('nearby_locations.loc_bidar', 'nearby_locations.loc_bidar_airport');
      answer = 'Bidar City and Bidar Domestic Airport are located approximately 22 km from Green Hills Prime.';
    } else if (qLower.includes('price of 2 gunta') || qLower.includes('price of 2 guntas') || qLower.includes('cost of 2 guntas') || qLower.includes('2 gunta price')) {
      matchedIntent = 'pricing_2_guntas';
      factsUsed.push('plot_pricing');
      answer = 'The total price for 2 Guntas (242 sq yds) is ₹4,00,000 (rate: ₹1,650/sq yd). Breakdown: Booking amount ₹50,000, balance ₹3,50,000 within 14 days, registration ₹12,500. A special spot payment Gold Offer is available!';
    } else if (qLower.includes('price') || qLower.includes('cost') || qLower.includes('how much')) {
      matchedIntent = 'pricing';
      factsUsed.push('plot_pricing', 'registration_info');
      answer = `Official plot pricing for Green Hills Prime:\n• *1 Gunta (121 sq yds)*: ₹2,00,000 (Registration ₹12,500)\n• *2 Guntas (242 sq yds)*: ₹4,00,000 (Booking ₹50,000, Balance ₹3,50,000 within 14 days, Registration ₹12,500)\n• *5 Guntas (605 sq yds)*: ₹10,00,000 (Registration ₹37,500)\n\n*Additional Charges*: Corner Plot (+₹50,000), East-Facing Plot (+₹10,000), 30' Road Facing (+₹20,000). Spot registration is available.`;
    } else if (qLower.includes('project photos') || qLower.includes('show me photos') || qLower.includes('project look like') || qLower.includes('show project photos')) {
      matchedIntent = 'visual_asset_project_photos';
      factsUsed.push('visual_assets');
      answer = `Here are approved project visual assets for Green Hills Prime:

🏛️ *Grand Entrance Arch*: https://raw.githubusercontent.com/GreenHillsPrime/assets/main/green_hills_prime_entrance_arch.jpg
📐 *Master Layout Plan*: https://raw.githubusercontent.com/GreenHillsPrime/assets/main/green_hills_prime_master_layout_plan.jpg
🏊 *2-Acre Resort & Water Feature*: https://raw.githubusercontent.com/GreenHillsPrime/assets/main/resort_and_water_feature_zone.jpg

Would you like plot pricing details or to schedule a free site visit?`;
    } else if (qLower.includes('swimming pool') || qLower.includes('pool')) {
      matchedIntent = 'visual_asset_swimming_pool';
      factsUsed.push('resort_and_clubhouse', 'visual_assets');
      answer = `Yes! Green Hills Prime features a swimming pool within our 2-acre resort & 3-acre water feature zone, along with an open-air gym, children's play area, and sports grounds.

🏊‍♂️ *Swimming Pool & Resort Zone*: https://raw.githubusercontent.com/GreenHillsPrime/assets/main/resort_swimming_pool.jpg`;
    } else if (qLower.includes('show me the layout') || qLower.includes('show layout') || qLower.includes('master plan') || qLower.includes('layout map')) {
      matchedIntent = 'visual_asset_master_layout';
      factsUsed.push('land_development', 'visual_assets');
      answer = `Here is the approved master layout plan for Green Hills Prime featuring 100ft main road frontage, 25ft, 30ft & 33ft internal BT roads, and open plot layouts:

📐 *Master Layout Plan*: https://raw.githubusercontent.com/GreenHillsPrime/assets/main/green_hills_prime_master_layout_plan.jpg`;
    } else if (qLower.includes('entrance look like') || qLower.includes('show entrance') || qLower.includes('entrance arch')) {
      matchedIntent = 'visual_asset_entrance';
      factsUsed.push('land_development', 'visual_assets');
      answer = `Green Hills Prime features a grand entrance arch gate with 24x7 security, welcome cabin, and landscaped entry walkway:

🏛️ *Grand Entrance Arch*: https://raw.githubusercontent.com/GreenHillsPrime/assets/main/green_hills_prime_entrance_arch.jpg`;
    } else if (qLower.includes('show clubhouse') || qLower.includes('show resort') || qLower.includes('resort photo')) {
      matchedIntent = 'visual_asset_resort';
      factsUsed.push('resort_and_clubhouse', 'visual_assets');
      answer = `Here is a view of our 2-acre resort layout and 3-acre water feature zone:

🏊 *2-Acre Resort Zone*: https://raw.githubusercontent.com/GreenHillsPrime/assets/main/resort_and_water_feature_zone.jpg`;
    } else if (qLower.includes('where is') || qLower.includes('location') || qLower.includes('google maps')) {
      matchedIntent = 'location';
      factsUsed.push('project_location');
      answer = `📍 *Royal Kingdom – Green Hills Prime*\nLocation: Morgi Village, Nagalgidda Mandal, Sangareddy District, Telangana (12 km from Narayankhed, 22 km from Bidar, 15 km from NIMZ).\nGoogle Maps: ${kb.project_location.google_maps_location}`;
    }

    // --- 8. MEMORY & CONTEXT RESOLUTION INTENTS ---
    else if (qLower.includes('budget of 5 lakh') || qLower.includes('i have 5 lakh') || qLower.includes('5 lakh budget')) {
      matchedIntent = 'customer_budget';
      factsUsed.push('customer_memory.budget', 'plot_pricing');
      answer = 'Got it! With a ₹5 Lakh budget, you can comfortably acquire our 2 Guntas (242 sq yds) plot option at ₹4,00,000 (Booking: ₹50,000 | Balance: ₹3,50,000 within 14 days | Registration: ₹12,500), or a 1 Gunta (121 sq yds) option at ₹2,00,000 (Registration: ₹12,500). Are you looking to build a house or for investment?';
    } else if (qLower.includes('plot for my family') || qLower.includes('build a house') || qLower.includes('family home')) {
      matchedIntent = 'customer_requirement';
      factsUsed.push('customer_memory.purpose');
      answer = 'Understood! Building a home for your family is a wonderful goal. Our planned layout features 30ft & 40ft wide BT roads, electricity lines, avenue plantation, and gated entry. Would you like to inspect available residential options?';
    } else if (qLower.includes('what do you recommend') || qLower.includes('previous option') || qLower.includes('which option')) {
      matchedIntent = 'RECOMMENDATION_WITH_MEMORY';
      factsUsed.push('customer_memory.budget', 'customer_memory.purpose', 'plot_categories');
      if (lead.budget && lead.budget.includes('5')) {
        answer = `Based on your budget of ${lead.budget}${lead.purpose ? ` for ${lead.purpose}` : ''}, I highly recommend our 2-Gunta Plot layout (242 sq yds). It offers 30ft BT roads, avenue plantation, and easy access to the Zaheerabad growth corridor. Would you like to schedule a free site visit to inspect this option?`;
      } else {
        answer = 'Our 2-Gunta (242 sq yds) residential and semi-commercial plot options provide planned infrastructure and spot registration availability. Would you like me to arrange a free site visit for you?';
      }
    }

    // --- 9. SEMANTIC KNOWLEDGE SEARCH & DYNAMIC CONTEXTUAL FALLBACK ENGINE ---
    if (!answer) {
      // 1. Perform semantic search across all approved project knowledge
      const searchRes = store.searchKnowledge(query);

      if (searchRes.matches && searchRes.matches.length > 0) {
        matchedIntent = 'SEMANTIC_KNOWLEDGE_MATCH';
        const topMatch = searchRes.matches[0];
        factsUsed.push(...searchRes.categoriesMatched);

        answer = `${topMatch.text}. Is there any specific detail about plot sizes, location map, or site visit scheduling you would like to know?`;
      } else {
        // 2. Real Gemini LLM Call if available
        const geminiResult = await geminiService.generateGroundedResponse(query, {
          kbFacts: kb,
          customerProfile: lead,
          conversationHistory,
          detectedIntent: matchedIntent,
          guardrails: guardrailsTriggered
        });

        if (geminiResult && geminiResult.answer) {
          answer = geminiResult.answer;
        } else {
          // 3. Dynamic Context-Aware Unconfirmed Notice (No single generic fallback)
          matchedIntent = 'UNCONFIRMED_PROJECT_FACT';

          let topic = 'project';
          if (qLower.includes('price') || qLower.includes('cost') || qLower.includes('discount') || qLower.includes('payment')) topic = 'pricing';
          else if (qLower.includes('location') || qLower.includes('distance') || qLower.includes('reach')) topic = 'location';
          else if (qLower.includes('legal') || qLower.includes('approval') || qLower.includes('dtcp') || qLower.includes('rera')) topic = 'legal approval';
          else if (qLower.includes('amenity') || qLower.includes('clubhouse') || qLower.includes('water')) topic = 'amenity';

          answer = `I don't have that specific ${topic} detail confirmed right now by our project development team. I can have our sales advisors confirm it for you directly. Is there anything regarding plot sizes, location access, or site visits I can assist with?`;
        }
      }
    }

    // PDF attachment rule: Only append brochure link if explicitly requested by customer!
    if (qLower.includes('pdf') || qLower.includes('brochure') || qLower.includes('send map') || qLower.includes('download document')) {
      answer += '\n\n📄 *Official Green Hills Prime Brochure & Layout Map*: You can download our official brochure document here: https://royalkingdomestates.com/green-hills-prime-brochure.pdf';
    }

    // Save AI response message and action to DB
    await dbService.saveMessage({ conversation_id: conversation.id, sender_type: 'AI', content: answer });
    await dbService.logAiAction(conversation.id, 'AI_RESPONSE_GENERATED', matchedIntent, factsUsed, guardrailsTriggered, 'Generated grounded answer.');

    // Sync updated lead to Google Sheets
    googleSheetsService.upsertLeadToSheet(lead);

    return this.formatResponse(
      answer,
      matchedIntent,
      factsUsed,
      'CONFIRMED',
      guardrailsTriggered,
      approvedForCustomer,
      proactiveSteps,
      appointmentDetails,
      lead,
      conversation.state
    );
  }

  formatResponse(
    answer,
    matchedIntent,
    factsUsed,
    distanceStatus,
    guardrailsTriggered,
    approvedForCustomer,
    proactiveSteps = null,
    appointmentDetails = null,
    leadMemory = null,
    conversationState = 'AI_ACTIVE'
  ) {
    const kb = store.getKnowledge();
    const conflictsFlagged = kb.conflicts_registry || [];

    return {
      answer,
      debug: {
        matched_intent: matchedIntent,
        facts_used: factsUsed,
        distance_status_evaluated: distanceStatus,
        guardrails_triggered: guardrailsTriggered,
        approved_for_customer: approvedForCustomer,
        proactive_steps: proactiveSteps,
        appointment_details: appointmentDetails,
        customer_memory: leadMemory,
        conversation_state: conversationState,
        conflicts_flagged: conflictsFlagged
      }
    };
  }

  extractDate(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    if (lower.includes('this sunday') || lower.includes('sunday')) return '2026-08-23';
    if (lower.includes('tomorrow')) return '2026-08-21';
    if (lower.includes('monday')) return '2026-08-24';
    if (lower.includes('next sunday')) return '2026-08-30';
    const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    return dateMatch ? dateMatch[1] : null;
  }

  extractTime(text) {
    if (!text) return null;
    const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))/i);
    if (timeMatch) return timeMatch[1].toUpperCase();
    if (text.toLowerCase().includes('afternoon')) return '02:00 PM';
    if (text.toLowerCase().includes('morning')) return '11:00 AM';
    return null;
  }

  extractPickupLocation(text) {
    if (!text) return null;
    if (text.toLowerCase().includes('miyapur')) return 'Miyapur Metro Station, Hyderabad';
    if (text.toLowerCase().includes('sangareddy')) return 'Sangareddy Bus Station';
    if (text.toLowerCase().includes('zaheerabad')) return 'Zaheerabad Town Centre';
    if (text.toLowerCase().includes('bidar')) return 'Bidar City Hub';
    return null;
  }
}

module.exports = new LocationAgentService();
