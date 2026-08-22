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

    // Test 3: "features"
    const res3 = await agentService.processQuery('features', { whatsapp_number: testPhone });
    assert(
      !res3.answer.includes("don't have that specific") && (res3.answer.includes('BT roads') || res3.answer.includes('resort') || res3.answer.includes('amenities')),
      '3. Single-word "features" returns amenities & project infrastructure facts directly without fallback.'
    );

    // Test 4: "amenities"
    const res4 = await agentService.processQuery('amenities', { whatsapp_number: testPhone });
    assert(
      !res4.answer.includes("don't have that specific") && res4.answer.includes('2-acre resort'),
      '4. Single-word "amenities" returns resort & infrastructure facts without fallback.'
    );

    // Test 5: "ameneties" (spelling typo test)
    const res5 = await agentService.processQuery('ameneties', { whatsapp_number: testPhone });
    assert(
      !res5.answer.includes("don't have that specific") && (res5.answer.includes('swimming pool') || res5.answer.includes('resort') || res5.answer.includes('BT roads')),
      '5. Typo "ameneties" is normalized and returns project amenities without fallback.'
    );

    // Test 6: "facilities"
    const res6 = await agentService.processQuery('facilities', { whatsapp_number: testPhone });
    assert(
      !res6.answer.includes("don't have that specific") && res6.answer.includes('BT roads'),
      '6. Single-word "facilities" returns project facility facts without fallback.'
    );

    // Test 7: "development"
    const res7 = await agentService.processQuery('development', { whatsapp_number: testPhone });
    assert(
      !res7.answer.includes("don't have that specific") && (res7.answer.includes('infrastructure') || res7.answer.includes('BT roads')),
      '7. Single-word "development" returns on-site infrastructure facts without fallback.'
    );

    // Test 8: "what is developed there?"
    const res8 = await agentService.processQuery('what is developed there?', { whatsapp_number: testPhone });
    assert(
      !res8.answer.includes("don't have that specific") && res8.answer.includes('BT roads'),
      '8. "what is developed there?" returns on-site infrastructure facts without fallback.'
    );

    // Test 9: "what development is there?"
    const res9 = await agentService.processQuery('what development is there?', { whatsapp_number: testPhone });
    assert(
      !res9.answer.includes("don't have that specific") && res9.answer.includes('electricity'),
      '9. "what development is there?" returns on-site infrastructure facts without fallback.'
    );

    // Test 10: "When can I visit?"
    const res10 = await agentService.processQuery('When can I visit?', { whatsapp_number: testPhone });
    assert(
      res10.answer.toLowerCase().includes('free site visit') || res10.answer.toLowerCase().includes('preferred date'),
      '10. "When can I visit?" offers free site visit and requests date/time.'
    );

    // Test 11: "Can I visit tomorrow?"
    const res11 = await agentService.processQuery('Can I visit tomorrow?', { whatsapp_number: testPhone });
    assert(
      res11.answer.includes('confirmed') || res11.answer.includes('Date:'),
      '11. "Can I visit tomorrow?" executes site visit booking flow.'
    );

    // Test 12: "Send me brochure" (Explicit PDF request)
    const res12 = await agentService.processQuery('Send me brochure', { whatsapp_number: testPhone });
    assert(
      res12.answer.includes('.pdf'),
      '12. "Send me brochure" shares PDF brochure link on explicit request.'
    );

    // Test 13: Unrelated question outside KB
    const res13 = await agentService.processQuery('What is the distance to Mars?', { whatsapp_number: testPhone });
    assert(
      res13.answer.includes("don't have that specific") || res13.answer.includes("sales advisors"),
      '13. Unrelated question outside KB returns unconfirmed detail notice without generic repetition.'
    );

    // Test 14: Conflict Registry Debug Tracking Check
    assert(
      Array.isArray(res13.debug.conflicts_flagged) && res13.debug.conflicts_flagged.length >= 3,
      '14. Response debug metadata tracks flagged source conflicts for admin review.'
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
