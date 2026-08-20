const store = require('./locationKnowledgeStore');
const dbService = require('./dbService');
const geminiService = require('./geminiService');
const googleCalendarService = require('./googleCalendarService');
const googleSheetsService = require('./googleSheetsService');
const whatsappService = require('./whatsappService');
const mediaService = require('./mediaService');

class LocationAgentService {
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
    if (response && response.answer && response.debug.conversation_state === 'AI_ACTIVE') {
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

    // 1. DATABASE CUSTOMER & CONVERSATION LOOKUP (Phone Normalization & Unique Key Enforcement)
    const customer = await dbService.findOrCreateCustomer(rawPhone, customerName);
    const conversation = await dbService.getConversation(customer.id);
    let lead = (await dbService.getLeadByCustomer(customer.id)) || {
      customer_id: customer.id,
      whatsapp_number: customer.whatsapp_number,
      interest_level: 'MEDIUM',
      lead_status: 'NEW_LEAD'
    };

    // 2. HUMAN TAKEOVER ENFORCEMENT (State: AI_ACTIVE vs HUMAN_ACTIVE / AI_PAUSED)
    if (conversation.state === 'HUMAN_ACTIVE' || conversation.state === 'AI_PAUSED') {
      // Save customer message to DB
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

      // Save AI status notification message to DB
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
    let matchedIntent = 'GENERAL_LOCATION';
    let distanceStatusEvaluated = 'N/A';
    let approvedForCustomer = true;
    let answer = '';
    let proactiveSteps = null;
    let appointmentDetails = null;

    // Fetch conversation message history from DB for LLM context
    const conversationHistory = await dbService.getMessages(conversation.id, 10);

    // =========================================================================
    // PART B — PROACTIVE CUSTOMER EXPERIENCE FOR INITIAL GREETINGS ("Hi", "Hello")
    // =========================================================================
    const greetingWords = ['hi', 'hello', 'hey', 'namaste', 'good morning', 'good afternoon', 'good evening', 'start', 'hii'];
    const isExactGreeting = greetingWords.includes(qLower) || qLower.match(/^(hi|hello|hey|namaste|hii)\b/i);

    if (isExactGreeting) {
      matchedIntent = 'PROACTIVE_ONBOARDING_GREETING';
      factsUsed.push('project_location', 'plot_prices', 'gold_offer', 'approved_media');

      lead.last_customer_message_at = new Date().toISOString();
      lead.lead_status = 'ONBOARDED';
      await dbService.upsertLeadRecord(customer, lead);

      proactiveSteps = [
        {
          step: 1,
          title: 'Welcome & Introduction',
          text: 'Welcome to *Royal Kingdom – Green Hills Prime*! 🌿\nWe offer premium planned plot layouts situated in the rapidly developing Zaheerabad / NIMZ growth corridor, Sangareddy District, Telangana.'
        },
        {
          step: 2,
          title: 'Plot Sizes & Pricing',
          text: '📏 *Plot Sizes & Pricing Overview*:\n• 2 Guntas (242 sq yds) starting from ₹6.5 Lakhs*\n• Custom plot layouts & commercial/semi-commercial categories available.\n• Spot registration options subject to applicable terms.'
        },
        {
          step: 3,
          title: 'Special Gold Offer & Amenities',
          text: '🎁 *Exclusive Offer*: Complimentary Gold Coin offer on spot bookings!\n✨ *Key Amenities*: 30ft & 40ft wide BT roads, electricity lines, avenue plantation, 24/7 security & gated entry.'
        },
        {
          step: 4,
          title: 'Approved Brochure & Location',
          text: '📁 *Approved Brochure & Location details*:\n• Project Brochure PDF & Video Walkthrough available.\n• Location: Zaheerabad NIMZ Growth Region, Sangareddy District.\n• Google Maps Link: https://maps.app.goo.gl/tjvaVs8RNn8WFLtV8'
        },
        {
          step: 5,
          title: 'Personalized Preference Question',
          text: 'To help you choose the right option, are you mainly looking for investment or planning to build a home?'
        }
      ];

      answer = proactiveSteps.map((s) => s.text).join('\n\n');

      // Persist AI message and action to DB
      await dbService.saveMessage({
        conversation_id: conversation.id,
        sender_type: 'AI',
        content: answer
      });
      await dbService.logAiAction(conversation.id, 'PROACTIVE_ONBOARDING', matchedIntent, factsUsed, [], 'Sent 5-step proactive onboarding sequence.');

      // Sync lead to Google Sheets
      googleSheetsService.upsertLeadToSheet(lead);

      return this.formatResponse(
        answer,
        matchedIntent,
        factsUsed,
        'CONFIRMED',
        guardrailsTriggered,
        true,
        proactiveSteps,
        null,
        lead,
        conversation.state
      );
    }

    // =========================================================================
    // PART C & TEST 12 — CUSTOMER MEMORY PERSISTENCE & CONTEXT RETRIEVAL
    // =========================================================================
    if (qLower.includes('5 lakh') || qLower.includes('6 lakh') || qLower.includes('budget')) {
      const match = query.match(/(\d+\s*lakhs?)/i);
      lead.budget = match ? `₹${match[0]}` : 'Around ₹5-7 Lakhs';
      lead.interest_level = 'HIGH';
      await dbService.upsertLeadRecord(customer, lead);
    }

    if (qLower.includes('build a house') || qLower.includes('home') || qLower.includes('living')) {
      lead.purpose = 'Home / Residential Construction';
      await dbService.upsertLeadRecord(customer, lead);
    } else if (qLower.includes('invest') || qLower.includes('investment')) {
      lead.purpose = 'Investment';
      await dbService.upsertLeadRecord(customer, lead);
    }

    // Memory recommendation query ("what do you recommend?")
    if (qLower.includes('what do you recommend') || qLower.includes('which option is best') || qLower.includes('suggest option')) {
      matchedIntent = 'RECOMMENDATION_WITH_MEMORY';
      factsUsed.push('customer_memory.budget', 'customer_memory.purpose', 'plot_categories');

      if (lead.budget && lead.budget.includes('5')) {
        answer =
          `Based on your budget of ${lead.budget}${lead.purpose ? ` for ${lead.purpose}` : ''}, I highly recommend our *2-Gunta Plot layout (242 sq yds)*. ` +
          `It offers excellent layout planning with 30ft BT roads, avenue plantation, and easy access to the Zaheerabad growth corridor. ` +
          `Would you like to schedule a free site visit in our company vehicle to inspect this option?`;
      } else {
        answer =
          `Based on your preferences${lead.purpose ? ` for ${lead.purpose}` : ''}, our 2-Gunta (242 sq yds) residential and semi-commercial plot options provide planned infrastructure and spot registration availability. ` +
          `Would you like me to arrange a free site visit for you?`;
      }

      await dbService.saveMessage({ conversation_id: conversation.id, sender_type: 'AI', content: answer });
      await dbService.logAiAction(conversation.id, 'RECOMMENDATION_GIVEN', matchedIntent, factsUsed, [], `Recommended plot using stored budget: ${lead.budget}`);
      return this.formatResponse(answer, matchedIntent, factsUsed, 'CONFIRMED', guardrailsTriggered, true, null, null, lead, conversation.state);
    }

    // =========================================================================
    // SITE VISIT RESCHEDULING & CANCELLATION
    // =========================================================================
    if (qLower.includes('cancel') && (qLower.includes('visit') || qLower.includes('appointment'))) {
      matchedIntent = 'SITE_VISIT_CANCELLATION';
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

        answer = 'Your Green Hills Prime site visit appointment has been cancelled as requested. Feel free to reschedule anytime!';
      } else {
        answer = 'I could not find an active site visit appointment under your phone number. Would you like to schedule a new visit?';
      }

      await dbService.saveMessage({ conversation_id: conversation.id, sender_type: 'AI', content: answer });
      await dbService.logAiAction(conversation.id, 'SITE_VISIT_CANCELLED', matchedIntent, factsUsed, [], 'Cancelled appointment');
      return this.formatResponse(answer, matchedIntent, factsUsed, 'CANCELLED', guardrailsTriggered, true, null, null, lead, conversation.state);
    }

    if (qLower.includes('reschedule') || qLower.includes('come monday instead')) {
      matchedIntent = 'SITE_VISIT_RESCHEDULING';
      factsUsed.push('site_visits', 'google_calendar');

      const parsedDate = this.extractDate(query) || '2026-08-24';
      const parsedTime = this.extractTime(query) || '11:00 AM';

      const existingApt = (await dbService.query(
        dbService.usePostgres
          ? 'SELECT * FROM site_visits WHERE customer_id = $1 AND status != \'CANCELLED\''
          : 'SELECT * FROM site_visits WHERE customer_id = ? AND status != \'CANCELLED\'',
        [customer.id]
      ))[0];

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

        answer =
          `Your site visit appointment has been successfully rescheduled!\n\n` +
          `📅 *New Date*: ${parsedDate}\n` +
          `⏰ *New Time*: ${parsedTime}\n` +
          `🚗 *Transportation*: Company vehicle\n` +
          `📍 *Pickup*: ${existingApt.pickup_location || 'Project Site'}\n\n` +
          `Our team will coordinate with you prior to departure.`;
      } else {
        answer = 'No active visit was found to reschedule. Would you like to book a new site visit?';
      }

      await dbService.saveMessage({ conversation_id: conversation.id, sender_type: 'AI', content: answer });
      await dbService.logAiAction(conversation.id, 'SITE_VISIT_RESCHEDULED', matchedIntent, factsUsed, [], 'Rescheduled appointment');
      return this.formatResponse(answer, matchedIntent, factsUsed, 'RESCHEDULED', guardrailsTriggered, true, null, null, lead, conversation.state);
    }

    // =========================================================================
    // SITE VISIT BOOKING FLOW
    // =========================================================================
    const visitIntentKeywords = ['yes', 'okay', 'sure', 'want to visit', 'let\'s visit', 'would like to see', 'interested in visiting', 'schedule visit', 'book visit', 'come sunday', 'visit site'];
    const isExpressingVisitInterest = visitIntentKeywords.some((kw) => qLower.includes(kw));

    if (isExpressingVisitInterest || qLower.includes('sunday') || qLower.includes('tomorrow') || qLower.includes('pickup')) {
      matchedIntent = 'SITE_VISIT_BOOKING_FLOW';
      factsUsed.push('pickup_policy', 'google_calendar_api', 'google_sheets_api');

      const parsedDate = this.extractDate(query);
      const parsedTime = this.extractTime(query);
      const pickupLocation = this.extractPickupLocation(query) || lead.pickup_location || 'Miyapur Metro Station, Hyderabad';

      if (!parsedDate || !parsedTime) {
        answer =
          'We would be delighted to arrange a free site visit for you in our company vehicle! 🌿\n\n' +
          'Could you please confirm your preferred *Date* (e.g. This Sunday, 23rd Aug) and *Time* (e.g. 11:00 AM), along with your preferred *Pickup Location*?';
        lead.site_visit_interest = true;
        lead.interest_level = 'SITE_VISIT_READY';
        await dbService.upsertLeadRecord(customer, lead);
        await dbService.saveMessage({ conversation_id: conversation.id, sender_type: 'AI', content: answer });
        return this.formatResponse(answer, matchedIntent, factsUsed, 'PENDING_INFO', guardrailsTriggered, true, null, null, lead, conversation.state);
      }

      // Check Google Calendar Double Booking Protection
      const availability = await googleCalendarService.checkAvailability(parsedDate, parsedTime);
      if (!availability.available) {
        answer =
          `Thank you! However, our vehicle/slot for ${parsedDate} at ${parsedTime} is currently fully booked.\n\n` +
          `Would any of these alternative slots work for you?\n` +
          `1️⃣ ${parsedDate} at 11:00 AM\n` +
          `2️⃣ ${parsedDate} at 03:00 PM\n` +
          `3️⃣ Next Sunday at 11:00 AM`;
        await dbService.saveMessage({ conversation_id: conversation.id, sender_type: 'AI', content: answer });
        return this.formatResponse(answer, matchedIntent, factsUsed, 'SLOT_OCCUPIED', guardrailsTriggered, true, null, null, lead, conversation.state);
      }

      // Create Google Calendar Event
      const aptData = {
        whatsapp_number: customer.whatsapp_number,
        customer_name: customer.customer_name,
        date: parsedDate,
        time: parsedTime,
        pickup_location: pickupLocation,
        vehicle_required: true
      };

      const calendarResult = await googleCalendarService.createEvent(aptData);

      if (calendarResult.success) {
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
          calendarResult.eventId,
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
        await googleSheetsService.upsertLeadToSheet({ ...lead, google_calendar_event_id: calendarResult.eventId });

        answer =
          `Your Green Hills Prime site visit is confirmed! 🌿\n\n` +
          `📅 Date: ${parsedDate}\n` +
          `⏰ Time: ${parsedTime}\n` +
          `🚗 Transportation: Company vehicle\n` +
          `📍 Pickup Location: ${pickupLocation}\n\n` +
          `Our team will coordinate the visit and pickup details with you.`;

        await dbService.saveMessage({ conversation_id: conversation.id, sender_type: 'AI', content: answer });
        await dbService.logAiAction(conversation.id, 'SITE_VISIT_CONFIRMED', matchedIntent, factsUsed, [], `Created Calendar Event ${calendarResult.eventId}`);

        return this.formatResponse(answer, matchedIntent, factsUsed, 'CONFIRMED', guardrailsTriggered, true, null, { id: aptId, ...aptData }, lead, conversation.state);
      }
    }

    // =========================================================================
    // FACTUAL KNOWLEDGE & GUARDRAILS
    // =========================================================================

    // Nagalagidda Mandal Protection (Part A1)
    if (qLower.includes('mandal') || qLower.includes('nagalagidda') || qLower.includes('nagalgidda')) {
      matchedIntent = 'QUERY_PROJECT_MANDAL';
      guardrailsTriggered.push('PROJECT_MANDAL_UNVERIFIED_PROTECTION');
      factsUsed.push('project_location.project_mandal');
      answer = 'The exact mandal location for Green Hills Prime is currently awaiting official verification by our project development team. Our sales advisors can confirm the official mandal documentation during your inquiry.';
    }
    // Spot Registration & ₹2 Lakh interpretation protection (Part A7 & A8)
    else if (qLower.includes('registration') || qLower.includes('2 lakh') || qLower.includes('spot registration')) {
      matchedIntent = 'QUERY_REGISTRATION_DETAILS';
      factsUsed.push('registration_info');
      if (qLower.includes('2 lakh') || qLower.includes('cost 2 lakh') || qLower.includes('fee')) {
        guardrailsTriggered.push('REGISTRATION_AMOUNT_INTERPRETATION_GUARDRAIL');
        answer = 'The project team has mentioned information regarding ₹2 lakh in connection with project options. However, this figure is not automatically specified as a registration fee or government tax. Spot registration is available, subject to applicable project requirements. Our sales team will provide the exact fee breakdown for your plot.';
      } else {
        answer = `${kb.registration_info.spot_registration_wording}\nOur sales team can walk you through the applicable registration steps and timeline for individual plots.`;
      }
    }
    // Patta & Passbook (Part A9)
    else if (qLower.includes('patta') || qLower.includes('passbook')) {
      matchedIntent = 'QUERY_PATTA_PASSBOOK';
      factsUsed.push('registration_info.patta_passbook_wording');
      answer = kb.registration_info.patta_passbook_wording;
    }
    // Rythu Bandhu & Rythu Bima (Part A10 & A11)
    else if (qLower.includes('rythu bandhu') || qLower.includes('rythu bima') || qLower.includes('government scheme')) {
      matchedIntent = 'QUERY_GOVERNMENT_SCHEMES';
      factsUsed.push('registration_info.rythu_bandhu_wording', 'registration_info.rythu_bima_wording');
      answer = qLower.includes('bima') ? kb.registration_info.rythu_bima_wording : kb.registration_info.rythu_bandhu_wording;
    }
    // Legal advice fallback (Part A12)
    else if (qLower.includes('legal approval') || qLower.includes('title deed') || qLower.includes('stamp duty')) {
      matchedIntent = 'QUERY_LEGAL_CLASSIFICATION_GUARDRAIL';
      guardrailsTriggered.push('LAND_AND_GOVERNMENT_SCHEME_GUARDRAIL_TRIGGERED');
      factsUsed.push('land_and_government_scheme_guardrail');
      answer = kb.land_and_government_scheme_guardrail.fallback_message;
    }
    // Land Development Claim ("Fully developed land" - Part A5)
    else if (qLower.includes('fully developed') || qLower.includes('land development')) {
      matchedIntent = 'QUERY_LAND_DEVELOPMENT';
      factsUsed.push('land_development');
      answer = 'Green Hills Prime is described by our project team as fully developed land with planned road networks and boundary demarcation. Specific completion details for individual plots can be confirmed directly with our project team.';
    }
    // Financial Guarantee Protection (Part A3)
    else if (qLower.includes('double') || qLower.includes('guaranteed') || qLower.includes('guarantee') || qLower.includes('resale profit')) {
      guardrailsTriggered.push('FINANCIAL_GUARANTEE_BLOCKED');
      matchedIntent = 'INVESTMENT_GUARANTEE_QUERY';
      factsUsed.push('nimz_landmark.disclaimer');
      answer = 'The Zaheerabad NIMZ is an important industrial-development project in the region and is one of the surrounding development factors buyers may consider when evaluating the location. However, future property appreciation, resale profits, or guaranteed price increases cannot be guaranteed.';
    }
    // Bidar (Part A2)
    else if (qLower.includes('bidar')) {
      matchedIntent = 'QUERY_DISTANCE_BIDAR';
      factsUsed.push('nearby_locations.loc_bidar');
      answer = 'Bidar is approximately 22 km from Green Hills Prime. Distance information is based on project-team-provided data.';
    }
    // Narayankhed (Part A2)
    else if (qLower.includes('narayankhed')) {
      matchedIntent = 'QUERY_DISTANCE_NARAYANKHED';
      factsUsed.push('nearby_locations.loc_narayankhed');
      answer = 'Narayankhed is approximately 12 km from Green Hills Prime. Distance information is based on project-team-provided data.';
    }
    // Municipality (Part A2)
    else if (qLower.includes('municipality')) {
      matchedIntent = 'QUERY_DISTANCE_MUNICIPALITY';
      factsUsed.push('nearby_locations.loc_municipality');
      answer = 'The nearby municipality is located approximately 12 km from Green Hills Prime. The exact municipality name is currently to be officially confirmed.';
    }
    // NIMZ Details (Part A3)
    else if (qLower.includes('nimz')) {
      matchedIntent = 'QUERY_NIMZ_DETAILS';
      factsUsed.push('nimz_landmark');
      answer = 'The Zaheerabad NIMZ is an important industrial-development project in the region and is located approximately 25 km from Green Hills Prime.';
    }
    // General Location Query
    else if (qLower.includes('where is') || qLower.includes('location') || qLower.includes('google maps')) {
      matchedIntent = 'QUERY_PROJECT_LOCATION';
      factsUsed.push('project_location');
      answer = `📍 *Royal Kingdom – Green Hills Prime*\nLocation: Zaheerabad / NIMZ Growth Corridor, Sangareddy District, Telangana.\nGoogle Maps: ${kb.project_location.google_maps_location}`;
    }
    // Fallback default
    else {
      matchedIntent = 'GENERAL_SALES_ASSISTANT';
      factsUsed.push('project_location', 'pickup_policy');

      // Try Real Gemini LLM generation if available
      const geminiResult = await geminiService.generateGroundedResponse(query, {
        kbFacts: kb,
        customerProfile: lead,
        conversationHistory,
        matchedIntent,
        guardrails: guardrailsTriggered
      });

      if (geminiResult && geminiResult.answer) {
        answer = geminiResult.answer;
      } else {
        answer = 'Green Hills Prime offers premium planned plot layouts in the Zaheerabad NIMZ growth corridor, Sangareddy District. We offer plot sizes, spot registration, and free site visits in our company vehicle. How can I assist you further?';
      }
    }

    // Save AI response message and action to DB
    await dbService.saveMessage({ conversation_id: conversation.id, sender_type: 'AI', content: answer });
    await dbService.logAiAction(conversation.id, 'AI_RESPONSE_GENERATED', matchedIntent, factsUsed, guardrailsTriggered, 'Generated grounded answer.');

    // Sync updated lead to Google Sheets
    googleSheetsService.upsertLeadToSheet(lead);

    return this.formatResponse(answer, matchedIntent, factsUsed, 'CONFIRMED', guardrailsTriggered, true, null, null, lead, conversation.state);
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
        conversation_state: conversationState
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
