const http = require('http');
const app = require('../server');

async function testRoutes() {
  console.log('--- Testing Real Local HTTP Express API Routes ---');

  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(5555, resolve));
  console.log('Test HTTP Server listening on port 5555');

  // Helper for real HTTP requests
  function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const options = {
        hostname: '127.0.0.1',
        port: 5555,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      };

      const req = http.request(options, (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(resData);
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: resData });
          }
        });
      });

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  try {
    // 1. Test GET /api/location/knowledge
    const res1 = await makeRequest('GET', '/api/location/knowledge');
    console.log(`GET /api/location/knowledge → HTTP ${res1.statusCode}`);
    if (res1.statusCode !== 200 || !res1.body.success) {
      console.error('FAILED GET /api/location/knowledge:', res1.body);
      server.close();
      process.exit(1);
    }

    // 2. Test POST /api/agent/chat
    const res2 = await makeRequest('POST', '/api/agent/chat', {
      message: 'Where is Green Hills Prime located?',
      whatsapp_number: '+919998887776',
      customer_name: 'Vercel Route Tester'
    });

    console.log(`POST /api/agent/chat → HTTP ${res2.statusCode}`);
    if (res2.statusCode !== 200 || !res2.body.success || !res2.body.response.answer) {
      console.error('FAILED POST /api/agent/chat:', res2.body);
      server.close();
      process.exit(1);
    }

    console.log('\nAI Grounded Response Sample:');
    console.log(res2.body.response.answer);
    console.log('\n✓ ALL REAL HTTP API ROUTE TESTS PASSED (HTTP 200)!');

    server.close();
    process.exit(0);
  } catch (err) {
    console.error('HTTP Test Error:', err);
    server.close();
    process.exit(1);
  }
}

testRoutes();
