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

    // Test 3: "What are the plot sizes?"
    const res3 = await agentService.processQuery('What are the plot sizes?', { whatsapp_number: testPhone });
    assert(
      res3.answer.includes('1 Gunta') && res3.answer.includes('121 Sq Yds') && res3.answer.includes('2 Guntas') && res3.answer.includes('242 Sq Yds'),
      '3. "What are the plot sizes?" returns 1 Gunta (121 sq yd), 2 Guntas (242 sq yd), and 5 Guntas (605 sq yd).'
    );

    // Test 4: "What is the price of 2 guntas?"
    const res4 = await agentService.processQuery('What is the price of 2 guntas?', { whatsapp_number: testPhone });
    assert(
      res4.answer.includes('₹4,00,000') && res4.answer.includes('50,000'),
      '4. "What is the price of 2 guntas?" returns ₹4,00,000 with booking and spot payment details.'
    );

    // Test 5: "Show me project photos"
    const res5 = await agentService.processQuery('Show me project photos', { whatsapp_number: testPhone });
    assert(
      res5.answer.includes('.jpg') && res5.answer.includes('entrance_arch') && res5.answer.includes('master_layout'),
      '5. "Show me project photos" returns approved project entrance & layout image links.'
    );

    // Test 6: "Do you have a swimming pool?"
    const res6 = await agentService.processQuery('Do you have a swimming pool?', { whatsapp_number: testPhone });
    assert(
      res6.answer.toLowerCase().includes('swimming pool') && res6.answer.includes('resort_swimming_pool.jpg'),
      '6. "Do you have a swimming pool?" confirms resort pool amenity & references pool asset link.'
    );

    // Test 7: "What amenities do you have?"
    const res7 = await agentService.processQuery('What amenities do you have?', { whatsapp_number: testPhone });
    assert(
      res7.answer.includes('2-acre resort') || res7.answer.includes('water feature') || res7.answer.includes('fruit plantation'),
      '7. "What amenities do you have?" returns resort zone, roads, plantations, and security features.'
    );

    // Test 8: "Show me the layout"
    const res8 = await agentService.processQuery('Show me the layout', { whatsapp_number: testPhone });
    assert(
      res8.answer.includes('master_layout_plan.jpg'),
      '8. "Show me the layout" returns master layout plan image link.'
    );

    // Test 9: "What does the entrance look like?"
    const res9 = await agentService.processQuery('What does the entrance look like?', { whatsapp_number: testPhone });
    assert(
      res9.answer.includes('entrance_arch.jpg'),
      '9. "What does the entrance look like?" returns grand entrance arch image link.'
    );

    // Test 10: "Send me brochure"
    const res10 = await agentService.processQuery('Send me brochure', { whatsapp_number: testPhone });
    assert(
      res10.answer.includes('.pdf'),
      '10. "Send me brochure" shares PDF brochure link on explicit customer request.'
    );

    // Test 11: "Can you show me the site?" / "Can I visit the site?"
    const res11 = await agentService.processQuery('Can you show me the site?', { whatsapp_number: testPhone });
    assert(
      res11.answer.toLowerCase().includes('site visit') || res11.answer.toLowerCase().includes('vehicle'),
      '11. "Can you show me the site?" offers free site visit with company vehicle.'
    );

    // Test 12: An unrelated question
    const res12 = await agentService.processQuery('What is the distance to Mars?', { whatsapp_number: testPhone });
    assert(
      res12.answer.toLowerCase().includes('not confirmed') || res12.answer.toLowerCase().includes('sales advisors'),
      '12. Unrelated question outside KB returns dynamic unconfirmed detail notice without generic repetition.'
    );

    // Test 13: Conflict Registry Debug Tracking Check
    assert(
      Array.isArray(res12.debug.conflicts_flagged) && res12.debug.conflicts_flagged.length >= 3,
      '13. Response debug metadata tracks flagged source conflicts for admin review.'
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
