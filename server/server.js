const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/apiRoutes');
const { rateLimiter } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register Rate Limiter
app.use(rateLimiter({ windowMs: 60000, max: 120 }));

// Register API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    agent: 'Green Hills Prime AI Agent',
    mode: process.env.WHATSAPP_MODE || 'mock',
    serverless_ready: true
  });
});

// Serve frontend production build if available
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Green Hills Prime AI Agent Server Running.');
    }
  });
});

// Start standalone HTTP server if executed directly (e.g. node server/server.js)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` GREEN HILLS PRIME AI AGENT SERVER RUNNING ON PORT ${PORT}`);
    console.log(` Location, PostgreSQL, Gemini & Meta Webhook Active`);
    console.log(`====================================================`);
  });
}

// Export Express app for Vercel serverless handler
module.exports = app;
