const agentService = require('../services/locationAgentService');
const dbService = require('../services/dbService');

async function runResponseEngineTests() {
  console.log('====================================================');
  console.log(' RUNNING AI RESPONSE ENGINE PIPELINE FIX TEST SUITE ');
  console.log('====================================================');

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
    const testPhone = `+919100${Math.floor(100000 + Math.random() * 900000)}`;

    // Test 1: First-contact greeting "Hi" -> returns promotional welcome message ONCE
    const res1 = await agentService.processQuery('Hi', { whatsapp_number: testPhone });
    assert(
      res1.answer.includes('Welcome to Royal Kingdom') && res1.answer.includes('Gold Offer'),
      '1. "Hi" from NEW customer returns promotional welcome message ONCE.'
    );

    // Test 2: Second turn from existing customer -> NO promotional welcome message banner
    const res2 = await agentService.processQuery('Where is the project?', { whatsapp_number: testPhone });
    assert(
      !res2.answer.includes('Gold Offer') && res2.answer.includes('Morgi Village') && res2.answer.includes('Nagalgidda'),
      '2. "Where is the project?" from EXISTING customer answers directly WITHOUT repeating welcome promo banner.'
    );

    // Test 3: "Is the area developed?"
    const res3 = await agentService.processQuery('Is the area developed?', { whatsapp_number: testPhone });
    assert(
      res3.answer.includes('BT roads') && res3.answer.includes('electricity') && res3.answer.includes('NIMZ'),
      '3. "Is the area developed?" returns verified project infrastructure & regional growth facts.'
    );

    // Test 4: "Will this area be developed?"
    const res4 = await agentService.processQuery('Will this area be developed?', { whatsapp_number: testPhone });
    assert(
      res4.answer.includes('NIMZ') && res4.answer.includes('roads') && !res4.answer.includes('not confirmed'),
      '4. "Will this area be developed?" returns verified growth facts without fallback.'
    );

    // Test 5: "What development is there?"
    const res5 = await agentService.processQuery('What development is there?', { whatsapp_number: testPhone });
    assert(
      res5.answer.includes('BT roads') || res5.answer.includes('infrastructure'),
      '5. "What development is there?" returns verified on-site development facts.'
    );

    // Test 6: "What facilities are developed?"
    const res6 = await agentService.processQuery('What facilities are developed?', { whatsapp_number: testPhone });
    assert(
      res6.answer.includes('roads') && res6.answer.includes('electricity'),
      '6. "What facilities are developed?" returns verified facility infrastructure facts.'
    );

    // Test 7: "How is the development there?"
    const res7 = await agentService.processQuery('How is the development there?', { whatsapp_number: testPhone });
    assert(
      res7.answer.includes('Zaheerabad NIMZ') || res7.answer.includes('infrastructure'),
      '7. "How is the development there?" returns verified development facts.'
    );

    // Test 8: "When can I visit?"
    const res8 = await agentService.processQuery('When can I visit?', { whatsapp_number: testPhone });
    assert(
      res8.answer.toLowerCase().includes('free site visit') || res8.answer.toLowerCase().includes('preferred date'),
      '8. "When can I visit?" offers free site visit and requests date/time.'
    );

    // Test 9: "When visit?"
    const res9 = await agentService.processQuery('When visit?', { whatsapp_number: testPhone });
    assert(
      res9.answer.toLowerCase().includes('site visit') || res9.answer.toLowerCase().includes('date'),
      '9. "When visit?" triggers site visit inquiry naturally.'
    );

    // Test 10: "Can I visit tomorrow?"
    const res10 = await agentService.processQuery('Can I visit tomorrow?', { whatsapp_number: testPhone });
    assert(
      res10.answer.includes('confirmed') || res10.answer.includes('Date:'),
      '10. "Can I visit tomorrow?" executes site visit booking flow.'
    );

    // Test 11: "Can I come Sunday?"
    const res11 = await agentService.processQuery('Can I come Sunday?', { whatsapp_number: testPhone });
    assert(
      res11.answer.includes('confirmed') || res11.answer.includes('Date:'),
      '11. "Can I come Sunday?" executes site visit booking flow.'
    );

    // Test 12: "I want to see the site."
    const res12 = await agentService.processQuery('I want to see the site.', { whatsapp_number: testPhone });
    assert(
      res12.answer.toLowerCase().includes('free site visit') || res12.answer.toLowerCase().includes('preferred date'),
      '12. "I want to see the site." offers free site visit.'
    );

    // Test 13: "Send me brochure" (Explicit PDF request)
    const res13 = await agentService.processQuery('Send me brochure', { whatsapp_number: testPhone });
    assert(
      res13.answer.includes('.pdf'),
      '13. "Send me brochure" shares PDF brochure link on explicit request.'
    );

    // Test 14: Unrelated question outside KB
    const res14 = await agentService.processQuery('What is the distance to Mars?', { whatsapp_number: testPhone });
    assert(
      res14.answer.toLowerCase().includes('not confirmed') || res14.answer.toLowerCase().includes('sales advisors'),
      '14. Unrelated question outside KB returns unconfirmed detail notice without generic repetition.'
    );

    // Test 15: Conflict Registry Debug Tracking Check
    assert(
      Array.isArray(res14.debug.conflicts_flagged) && res14.debug.conflicts_flagged.length >= 3,
      '15. Response debug metadata tracks flagged source conflicts for admin review.'
    );

    console.log('----------------------------------------------------');
    console.log(`RESULTS: ${passed}/${total} AI Response Engine Pipeline tests passed.`);

    if (passed === total) {
      console.log('ALL AI RESPONSE ENGINE PIPELINE TESTS PASSED!');
      return true;
    } else {
      console.error('SOME TESTS FAILED.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  runResponseEngineTests();
}

module.exports = runResponseEngineTests;
