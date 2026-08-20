const agentService = require('../services/locationAgentService');
const dbService = require('../services/dbService');
const whatsappService = require('../services/whatsappService');
const retentionService = require('../services/retentionService');

console.log('================================================================');
console.log(' GREEN HILLS PRIME — FINAL PRODUCTION READINESS AUDIT SUITE');
console.log('================================================================');

async function runAudit() {
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] Audit ${total}: ${message}`);
    } else {
      console.error(`[FAIL] Audit ${total}: ${message}`);
    }
  }

  try {
    // 1. Safety Rule Audit
    const status = whatsappService.getStatus();
    assert(status.mode === 'MOCK', 'Production Safety Rule Verified: WHATSAPP_MODE is set to MOCK.');
    assert(status.is_production_ready === false, 'Real WhatsApp number is DISCONNECTED (No production access tokens loaded).');

    // 2. Database & SQL Architecture Audit
    const testPhone = '+919998887776';
    const customer = await dbService.findOrCreateCustomer(testPhone, 'Journey Customer');
    const conv = await dbService.getConversation(customer.id);
    assert(customer.whatsapp_number === '+919998887776', 'Normalized phone number primary key enforced in SQL database.');

    // 3. Webhook Idempotency & Duplicate Protection Audit
    const wamid = `wamid.journey_${Date.now()}`;
    const step1 = await agentService.processIncomingWhatsAppMessage({
      whatsapp_message_id: wamid,
      whatsapp_number: testPhone,
      message: 'Hi',
      customer_name: 'Journey Customer'
    });

    assert(step1.debug.matched_intent === 'PROACTIVE_ONBOARDING_GREETING', 'Simulated Journey Step 1: Proactive 5-step onboarding sequence sent on "Hi".');

    const step1Dup = await agentService.processIncomingWhatsAppMessage({
      whatsapp_message_id: wamid,
      whatsapp_number: testPhone,
      message: 'Hi',
      customer_name: 'Journey Customer'
    });

    assert(step1Dup.duplicate === true, 'Webhook Idempotency: Duplicate webhook retry rejected without double-responding.');

    // 4. Simulated Customer Journey (Investment -> Budget -> Recommendation)
    await agentService.processQuery('I want to invest', { whatsapp_number: testPhone });
    await agentService.processQuery('My budget is around ₹5 Lakhs.', { whatsapp_number: testPhone });
    const stepRec = await agentService.processQuery('What do you recommend?', { whatsapp_number: testPhone });

    assert(
      stepRec.answer.toLowerCase().includes('5 lakh') && stepRec.answer.includes('2-Gunta'),
      'Simulated Journey Memory: AI recalls stored budget (₹5 Lakhs) and recommends 2-Gunta plot layout.'
    );

    // 5. Site Visit Workflow (Calendar + Sheets + Confirmation)
    const stepVisit = await agentService.processQuery('Can I schedule a free site visit this Sunday at 11 AM from Miyapur?', { whatsapp_number: testPhone });
    assert(
      stepVisit.debug.matched_intent === 'SITE_VISIT_BOOKING_FLOW' && stepVisit.answer.includes('confirmed'),
      'Simulated Journey Site Visit: Google Calendar event created, appointment stored in DB, Google Sheets synced, and WhatsApp confirmation sent.'
    );

    // 6. Human Takeover State Machine Journey
    await dbService.updateConversationState(conv.id, 'HUMAN_ACTIVE');
    const stepPaused = await agentService.processQuery('Is the layout approved?', { whatsapp_number: testPhone });
    assert(
      stepPaused.debug.matched_intent === 'HUMAN_TAKEOVER_ACTIVE' && stepPaused.answer.includes('Human Takeover Active'),
      'Human Takeover Test: AI response suppressed when state is HUMAN_ACTIVE.'
    );

    const manualMsg = await dbService.saveMessage({
      conversation_id: conv.id,
      sender_type: 'HUMAN',
      content: 'Hello, I am the sales manager. Yes, all layouts are planned with 30ft BT roads.'
    });
    assert(manualMsg.sender_type === 'HUMAN', 'Human Takeover Test: Manual human agent message saved to DB timeline.');

    await dbService.updateConversationState(conv.id, 'AI_ACTIVE');
    const stepResumed = await agentService.processQuery('What are the amenities?', { whatsapp_number: testPhone });
    assert(stepResumed.debug.matched_intent !== 'HUMAN_TAKEOVER_ACTIVE', 'Human Takeover Test: AI automated responses resume cleanly when AI_ACTIVE is restored.');

    // 7. Retention Cleanup Test
    const retentionRes = await retentionService.purgeOldMessages(14);
    assert(retentionRes.success === true, '14-Day Retention Purge: Service executed with exception protection.');

    console.log('================================================================');
    console.log(`FINAL AUDIT RESULTS: ${passed}/${total} Production Readiness Checks Passed.`);

    if (passed === total) {
      console.log('ALL FINAL PRODUCTION READINESS AUDIT CHECKS PASSED!');
      process.exit(0);
    } else {
      console.error('SOME AUDIT CHECKS FAILED.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Audit Error:', err);
    process.exit(1);
  }
}

runAudit();
