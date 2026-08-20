/**
 * GREEN HILLS PRIME ADMIN SECURITY & RATE LIMITING MIDDLEWARE
 */

const ADMIN_SECRET = process.env.ADMIN_SECRET_TOKEN || 'green_hills_admin_secret_2026';

// In-memory rate limiting bucket for serverless functions
const ipBuckets = new Map();

function rateLimiter(options = { windowMs: 60000, max: 100 }) {
  return (req, res, next) => {
    // Exempt Meta WhatsApp Webhook endpoints from rate limiting
    if (req.path.startsWith('/api/whatsapp/webhook')) {
      return next();
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const bucket = ipBuckets.get(ip) || { count: 0, resetAt: now + options.windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 1;
      bucket.resetAt = now + options.windowMs;
    } else {
      bucket.count++;
    }

    ipBuckets.set(ip, bucket);

    if (bucket.count > options.max) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please wait before retrying.'
      });
    }

    next();
  };
}

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.admin_token;

  // In production mode, require strict ADMIN_SECRET_TOKEN match
  if (process.env.NODE_ENV === 'production' || process.env.STRICT_ADMIN_AUTH === 'true') {
    if (!token || token !== ADMIN_SECRET) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid X-Admin-Token header required to access administrative API endpoints.'
      });
    }
  }

  req.isAdmin = true;
  next();
}

function sanitizeError(err) {
  if (!err) return 'Unknown error';
  let message = typeof err === 'string' ? err : err.message || JSON.stringify(err);

  // Mask sensitive credentials if present in stack traces
  message = message.replace(/(Bearer\s+)[A-Za-z0-9\-\._~\+\/]+=*/gi, '$1[MASKED_TOKEN]');
  message = message.replace(/(AIzaSy)[A-Za-z0-9\-_]{33}/gi, '[MASKED_GEMINI_KEY]');
  message = message.replace(/(postgres:\/\/)[^@]+@/gi, '$1[MASKED_DB_CREDS]@');

  return message;
}

module.exports = {
  rateLimiter,
  adminAuth,
  sanitizeError
};
