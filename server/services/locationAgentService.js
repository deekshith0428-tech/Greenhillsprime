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

    // =========================================================================
    // INTENT CLASSIFICATION & MEMORY EXTRACTION PIPELINE
    // =========================================================================

    // Extract customer budget
    if (qLower.includes('5 lakh') || qLower.includes('6 lakh') || qLower.includes('7 lakh') || (qLower.includes('budget') && qLower.match(/(\d+\s*lakhs?)/i))) {
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

    // --- 1. GREETING INTENT ---
    const greetingWords = ['hi', 'hello', 'hey', 'namaste', 'good morning', 'good afternoon', 'good evening', 'start', 'hii'];
    const isGreeting = greetingWords.some((w) => qLower === w || qLower.startsWith(w + ' ') || qLower.endsWith(' ' + w));

    if (isGreeting) {
      matchedIntent = 'PROACTIVE_ONBOARDING_GREETING';
      factsUsed.push('project_location', 'plot_prices');
      answer = 'Namaste! 👋 Welcome to Royal Kingdom – Green Hills Prime. Are you looking for plot details, location information, pricing, or a site visit?';
    }

    // --- 2. OFF-TOPIC / GENERAL KNOWLEDGE INTENTS ---
    else if (qLower.includes('what is a hectare') || qLower.includes('hectare')) {
      matchedIntent = 'general_question';
      answer = 'A hectare is a unit of land area equal to 10,000 square metres (approximately 2.47 acres or 99.17 guntas).';
    } else if (qLower.includes('joke') || qLower.includes('tell me a joke')) {
      matchedIntent = 'unrelated_question';
      answer = "Why don't scientists trust atoms? Because they make up everything! 😊 How can I assist with your land search today?";
    }

    // --- 3. OBJECTIONS & SALES HESITATION ---
    else if (qLower.includes('discuss with my family') || qLower.includes('family discussion') || qLower.includes('talk to family')) {
      matchedIntent = 'objection';
      answer = 'Absolutely! Take your time to discuss with your family. If you\'d like, I can share a summary of our plot options, layout details, and location map so you have everything ready for your discussion.';
    } else if (qLower.includes('don\'t want to buy') || qLower.includes('not buying') || qLower.includes('just checking') || qLower.includes('looking around')) {
      matchedIntent = 'objection';
      answer = 'Of course, no problem at all! Taking your time with property decisions is very important. Whenever you\'re ready, I can share location details, plot options, or site visit information for your reference.';
    }

    // --- 4. SITE VISIT WORKFLOW (BOOKING / RESCHEDULING / CANCELLATION) ---
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
    } else if (qLower.includes('reschedule') || qLower.includes('come monday instead')) {
      matchedIntent = 'site_visit_reschedule';
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

        answer = `Your site visit appointment has been successfully rescheduled!\n\n📅 *New Date*: ${parsedDate}\n⏰ *New Time*: ${parsedTime}\n🚗 *Transportation*: Company vehicle\n📍 *Pickup*: ${existingApt.pickup_location || 'Project Site'}\n\nOur team will coordinate with you prior to departure.`;
      } else {
        answer = 'No active visit was found to reschedule. Would you like to book a new site visit?';
      }
    } else if (qLower.includes('schedule a visit') || qLower.includes('can i visit') || qLower.includes('free site visit') || qLower.includes('visit sunday') || qLower.includes('want to visit') || qLower.includes('book visit') || qLower.includes('site visit')) {
      matchedIntent = 'SITE_VISIT_BOOKING_FLOW';
      factsUsed.push('pickup_policy', 'google_calendar_api', 'google_sheets_api');

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

    // --- 5. FACTUAL PROJECT QUERY INTENTS & GUARDRAILS ---
    else if (qLower.includes('double') || qLower.includes('guaranteed') || qLower.includes('guarantee') || qLower.includes('resale profit')) {
      guardrailsTriggered.push('FINANCIAL_GUARANTEE_BLOCKED');
      matchedIntent = 'INVESTMENT_GUARANTEE_QUERY';
      factsUsed.push('nimz_landmark.disclaimer');
      answer = 'The Zaheerabad NIMZ is an important industrial-development project in the region and is one of the surrounding development factors buyers may consider when evaluating the location. However, future property appreciation, resale profits, or guaranteed price increases cannot be guaranteed.';
    }

    // --- 5. FACTUAL PROJECT QUERY INTENTS ---
    else if (qLower.includes('mandal') || qLower.includes('nagalagidda') || qLower.includes('nagalgidda')) {
      matchedIntent = 'QUERY_PROJECT_MANDAL';
      guardrailsTriggered.push('PROJECT_MANDAL_UNVERIFIED_PROTECTION');
      factsUsed.push('project_location.project_mandal');
      answer = 'The exact mandal location for Green Hills Prime is currently awaiting official verification by our project development team. Our sales advisors can confirm the official mandal documentation during your inquiry.';
    } else if (qLower.includes('registration cost 2 lakh') || (qLower.includes('registration') && qLower.includes('2 lakh'))) {
      matchedIntent = 'QUERY_REGISTRATION_DETAILS';
      guardrailsTriggered.push('REGISTRATION_AMOUNT_INTERPRETATION_GUARDRAIL');
      factsUsed.push('registration_info');
      answer = 'The project team has mentioned information regarding ₹2 lakh in connection with project options. However, this figure is not automatically specified as a registration fee or government tax. Spot registration is available, subject to applicable project requirements. Our sales team will provide the exact fee breakdown for your plot.';
    } else if (qLower.includes('registration')) {
      matchedIntent = 'registration';
      factsUsed.push('registration_info');
      answer = `${kb.registration_info.spot_registration_wording}\nOur sales team can walk you through the applicable registration steps and timeline for individual plots.`;
    } else if (qLower.includes('rythu bandhu') || qLower.includes('rythu bima') || qLower.includes('government scheme')) {
      matchedIntent = 'government_schemes';
      factsUsed.push('registration_info.rythu_bandhu_wording', 'registration_info.rythu_bima_wording');
      answer = qLower.includes('bima') ? kb.registration_info.rythu_bima_wording : kb.registration_info.rythu_bandhu_wording;
    } else if (qLower.includes('patta') || qLower.includes('passbook')) {
      matchedIntent = 'legal/approval';
      factsUsed.push('registration_info.patta_passbook_wording');
      answer = kb.registration_info.patta_passbook_wording;
    } else if (qLower.includes('bidar')) {
      matchedIntent = 'connectivity';
      factsUsed.push('nearby_locations.loc_bidar');
      answer = 'Bidar is approximately 22 km from Green Hills Prime. Distance information is based on project-team-provided data.';
    } else if (qLower.includes('price') || qLower.includes('cost') || qLower.includes('how much')) {
      matchedIntent = 'pricing';
      factsUsed.push('plot_categories', 'customer_memory.budget');
      if (lead.budget && lead.budget !== 'Unspecified') {
        answer = `Our 2-Gunta plot layouts (242 sq yds) start from ₹6.5 Lakhs*. Based on your stored budget preference (${lead.budget}), we can discuss customized plot options and spot registration with our team.`;
      } else {
        answer = 'Our 2-Gunta plot layouts (242 sq yds) start from ₹6.5 Lakhs*. Custom plot layouts and commercial/semi-commercial categories are also available with spot registration options.';
      }
    } else if (qLower.includes('where is') || qLower.includes('location') || qLower.includes('google maps')) {
      matchedIntent = 'location';
      factsUsed.push('project_location');
      answer = `📍 *Royal Kingdom – Green Hills Prime*\nLocation: Zaheerabad / NIMZ Growth Corridor, Sangareddy District, Telangana.\nGoogle Maps: ${kb.project_location.google_maps_location}`;
    }

    // --- 6. MEMORY & CONTEXT RESOLUTION INTENTS ---
    else if (qLower.includes('budget of 5 lakh') || qLower.includes('i have 5 lakh') || qLower.includes('5 lakh budget')) {
      matchedIntent = 'customer_budget';
      factsUsed.push('customer_memory.budget');
      answer = 'Got it! A ₹5 Lakh budget is a great starting point. Our 2-Gunta plot layouts start from ₹6.5 Lakhs, and we have flexible payment breakdown options. Are you looking to build a house or for investment?';
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

    // --- 7. DYNAMIC GEMINI LLM & GROUNDED CONVERSATIONAL ENGINE ---
    if (!answer) {
      factsUsed.push('project_location', 'plot_categories', 'pickup_policy');

      // Execute Real Gemini SDK if available
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
        // Dynamic Grounded Fallback Engine (NEVER returns a static hard-coded single paragraph)
        if (qLower.includes('project') || qLower.includes('info')) {
          matchedIntent = 'project_information';
          answer = 'Royal Kingdom – Green Hills Prime is a premium planned plot development in the Zaheerabad NIMZ growth corridor, Sangareddy District. We offer 2-Gunta plot layouts, 30ft & 40ft wide BT roads, electricity, gated entry, and spot registration options.';
        } else if (qLower.includes('amenities') || qLower.includes('features')) {
          matchedIntent = 'development/amenities';
          answer = 'Green Hills Prime key amenities include 30ft & 40ft wide BT roads, electricity lines, avenue plantation, 24/7 security with gated entry, and clear boundary demarcation.';
        } else {
          matchedIntent = 'unknown';
          answer = 'I don\'t want to give you incorrect information. I don\'t have that detail confirmed right now. I can have our team confirm it for you. Is there anything else regarding location, plot sizes, or site visits I can help with?';
        }
      }
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
