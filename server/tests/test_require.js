const agentService = require('../services/locationAgentService');
console.log('LocationAgentService loaded successfully!');
agentService.processQuery('Hi').then(res => {
  console.log('Agent Response:', res.answer);
}).catch(err => console.error('Error:', err));
