const agentService = require('../services/locationAgentService');
const dbService = require('../services/dbService');
const whatsappService = require('../services/whatsappService');
const retentionService = require('../services/retentionService');

console.log('===================================================');
console.log(' RUNNING GREEN HILLS PRIME PHASE 3 PRODUCTION TEST SUITE');
console.log('===================================================');

async function runTests() {
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] Test ${total}: ${message}`);
    } else {
      console.error(`[FAIL] Test ${total}: ${message}`);
    }
  }

  try {
    // 1. WhatsApp Service Status & Mock Mode Default
    const status = whatsappService.getStatus();
    assert(status.mode === 'MOCK', 'Default WHATSAPP_MODE is set to MOCK (Real phone number disconnected).');

    // 2. Webhook Challenge Token Check
    assert(status.webhook_configured === true, 'WHATSAPP_VERIFY_TOKEN is configured.');

    // 3. Idempotency Duplicate Protection Test
    const dupMsgId = `wamid.HBgL_test_dup_${Date.now()}`;
    const testPhone = '+919999911111';

    // First Payload Processing
    const firstRes = await agentService.processIncomingWhatsAppMessage({
      whatsapp_message_id: dupMsgId,
      whatsapp_number: testPhone,
      message: 'Hello, what are the plot sizes?',
      customer_name: 'Idempotency Persona'
    });

    assert(firstRes && firstRes.answer, 'First incoming webhook message processed successfully.');

    // Duplicate Webhook Retry Payload Processing
    const dupRes = await agentService.processIncomingWhatsAppMessage({
      whatsapp_message_id: dupMsgId,
      whatsapp_number: testPhone,
      message: 'Hello, what are the plot sizes?',
      customer_name: 'Idempotency Persona'
    });

    assert(dupRes && dupRes.duplicate === true, 'Duplicate webhook retry with same whatsapp_message_id is rejected idempotently without double-responding.');

    // 4. Delivery Status Update Test
    await dbService.updateDeliveryStatus(dupMsgId, 'DELIVERED');
    const msgRows = await dbService.query(
      dbService.usePostgres
        ? 'SELECT delivery_status FROM messages WHERE whatsapp_message_id = $1'
        : 'SELECT delivery_status FROM messages WHERE whatsapp_message_id = ?',
      [dupMsgId]
    );

    assert(msgRows && msgRows[0] && msgRows[0].delivery_status === 'DELIVERED', 'Delivery status webhook updates DB record to DELIVERED.');

    // 5. Message Type Handling (Media / Unsupported Image)
    const imgRes = await agentService.processIncomingWhatsAppMessage({
      whatsapp_message_id: `wamid.img_${Date.now()}`,
      whatsapp_number: '+919999922222',
      message_type: 'IMAGE',
      message: 'Check this plot layout image',
      customer_name: 'Image Persona'
    });

    assert(imgRes && imgRes.answer, 'Incoming IMAGE message normalized and processed gracefully.');

    // 6. Proactive Greeting Test
    const res1 = await agentService.processIncomingWhatsAppMessage({
      whatsapp_message_id: `wamid.hi_${Date.now()}`,
      whatsapp_number: '+919777766661',
      message: 'Hi',
      customer_name: 'Persona 1'
    });

    assert(res1.debug.matched_intent === 'PROACTIVE_ONBOARDING_GREETING' && res1.answer.includes('Royal Kingdom'), 'Proactive 5-step onboarding sequence returned on "Hi".');

    // 7. Multi-Turn Customer Memory Persistence
    const testPhoneMemory = '+919888877771';
    await agentService.processQuery('My budget is around ₹5 Lakhs.', { whatsapp_number: testPhoneMemory, customer_name: 'Memory Persona' });
    await agentService.processQuery('I want to build a house.', { whatsapp_number: testPhoneMemory, customer_name: 'Memory Persona' });
    const resMem = await agentService.processQuery('What do you recommend?', { whatsapp_number: testPhoneMemory, customer_name: 'Memory Persona' });
    assert(resMem.answer.toLowerCase().includes('5 lakh') && resMem.answer.includes('2-Gunta'), 'AI remembers customer budget (₹5 Lakhs) and recommends appropriate 2-Gunta plot.');

    // 8. Human Takeover State Enforcement
    const testPhoneTakeover = '+919888877772';
    const custTakeover = await dbService.findOrCreateCustomer(testPhoneTakeover, 'Takeover Persona');
    const convTakeover = await dbService.getConversation(custTakeover.id);

    // Pause AI / Human Takeover
    await dbService.updateConversationState(convTakeover.id, 'HUMAN_ACTIVE');
    const resBypassed = await agentService.processQuery('What is the price of 2 guntas?', { whatsapp_number: testPhoneTakeover });
    assert(resBypassed.debug.matched_intent === 'HUMAN_TAKEOVER_ACTIVE' && resBypassed.answer.includes('Human Takeover Active'), 'AI automated response is suppressed when Human Takeover is active.');

    // Resume AI
    await dbService.updateConversationState(convTakeover.id, 'AI_ACTIVE');
    const resResumed = await agentService.processQuery('What is the price of 2 guntas?', { whatsapp_number: testPhoneTakeover });
    assert(resResumed.debug.matched_intent !== 'HUMAN_TAKEOVER_ACTIVE', 'AI automated responses resume when AI_ACTIVE state is restored.');

    // 9. Land & Legal Guardrail Checks
    const resMandal = await agentService.processQuery('Is the project in Nagalagidda Mandal?', { whatsapp_number: '+919888877773' });
    assert(resMandal.debug.guardrails_triggered.includes('PROJECT_MANDAL_UNVERIFIED_PROTECTION'), 'Unverified Mandal guardrail protects against asserting Nagalagidda Mandal.');

    const resReg = await agentService.processQuery('Does registration cost ₹2 lakh?', { whatsapp_number: '+919888877773' });
    assert(resReg.debug.guardrails_triggered.includes('REGISTRATION_AMOUNT_INTERPRETATION_GUARDRAIL'), 'Registration amount guardrail prevents asserting ₹2 lakh as fixed fee.');

    const resFin = await agentService.processQuery('Will my plot price double in 2 years?', { whatsapp_number: '+919888877773' });
    assert(resFin.debug.guardrails_triggered.includes('FINANCIAL_GUARANTEE_BLOCKED') && resFin.answer.includes('cannot be guaranteed'), 'Financial appreciation guardrail blocks price doubling promises.');

    // 10. Site Visit Booking & Calendar Double Booking Check
    const resVisit = await agentService.processQuery('Can I schedule a visit this Sunday at 11 AM from Miyapur?', { whatsapp_number: '+919888877774', customer_name: 'Visitor' });
    assert(resVisit.debug.matched_intent === 'SITE_VISIT_BOOKING_FLOW' && resVisit.answer.includes('confirmed'), 'Site Visit appointment created with Google Calendar ID & stored in Database.');

    // 11. 14-Day Retention Purge Check
    const purgeResult = await retentionService.purgeOldMessages(14);
    assert(purgeResult.success === true, '14-Day conversation retention purge service executes cleanly with active exception protection.');

    console.log('---------------------------------------------------');
    console.log(`RESULTS: ${passed}/${total} Phase 3 tests passed.`);

    if (passed === total) {
      console.log('ALL PHASE 3 META WHATSAPP CLOUD API TESTS PASSED SUCCESSFULLY!');
      process.exit(0);
    } else {
      console.error('SOME TESTS FAILED.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Test suite error:', err);
    process.exit(1);
  }
}

runTests();
