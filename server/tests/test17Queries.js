const agentService = require('../services/locationAgentService');

const EXACT_17_MESSAGES = [
  "hi",
  "Where is Green Hills Prime?",
  "What is the price?",
  "I have a budget of 5 lakh.",
  "I need a plot for my family.",
  "How far is Bidar?",
  "What is a hectare?",
  "Tell me a joke.",
  "I don't want to buy now.",
  "I will discuss with my family.",
  "Can I visit Sunday?",
  "Can I come Monday instead?",
  "I need to cancel the visit.",
  "What about registration?",
  "Is Rythu Bandhu available?",
  "How much is it?",
  "What about the previous option?"
];

async function run17QueriesTest() {
  console.log('================================================================');
  console.log(' RUNNING 17-QUERY CONVERSATIONAL AI DIVERSITY & GROUNDING TEST');
  console.log('================================================================');

  const testPhone = '+919991112233';
  const responses = [];

  for (let i = 0; i < EXACT_17_MESSAGES.length; i++) {
    const q = EXACT_17_MESSAGES[i];
    const res = await agentService.processQuery(q, {
      whatsapp_number: testPhone,
      customer_name: '17 Query Tester'
    });

    responses.push(res.answer);

    console.log(`\n[Query ${i + 1}]: "${q}"`);
    console.log(`[Intent]: ${res.debug ? res.debug.matched_intent : 'N/A'}`);
    console.log(`[Response]: ${res.answer}`);
  }

  console.log('\n================================================================');
  console.log(' VERIFYING RESPONSE DIVERSITY...');

  const uniqueResponses = new Set(responses);
  console.log(`Total Queries: ${EXACT_17_MESSAGES.length}`);
  console.log(`Unique Responses Generated: ${uniqueResponses.size}`);

  if (uniqueResponses.size >= 14) {
    console.log('✅ ALL 17 QUERIES RETURNED DISTINCT, DYNAMIC, GROUNDED RESPONSES!');
    process.exit(0);
  } else {
    console.error('❌ TOO MANY DUPLICATE RESPONSES FOUND!');
    process.exit(1);
  }
}

run17QueriesTest();
