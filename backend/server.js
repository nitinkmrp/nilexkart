import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dbConnect from './config/db.js';
import userRoutes from './routes/user.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import waitlistRoutes from './routes/waitlist.routes.js';
import productRoutes    from './routes/products.routes.js';
import categoryRoutes  from './routes/categories.routes.js';
import billRoutes      from './routes/bills.routes.js';
import customerRoutes  from './routes/customers.routes.js';
import aiRoutes        from './routes/ai.routes.js';
import authRoutes      from './routes/auth.routes.js';
import adminRoutes     from './routes/admin.routes.js';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

// ── Warn if JWT secret is the unsafe fallback ──────────────────────
const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_SECRET_KEY;
if (!process.env.JWT_SECRET) {
  console.warn('\n⚠️  WARNING: JWT_SECRET is not set in .env! Using ADMIN_SECRET_KEY as fallback.');
  console.warn('   Set JWT_SECRET in your Render environment variables for production security.\n');
}

const app = express();

// ── Trust Render/Vercel proxy so req.ip = real client IP ─────────────────
// Without this, ALL users share the load-balancer IP and get blocked together
app.set('trust proxy', 1);

// ── Security Headers (Helmet) ────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow Cloudinary images
  contentSecurityPolicy: false,                           // disable CSP (React handles it)
}));

// ── Dynamic Rate Limiter (admin-controllable) ────────────────────
// Config is mutable — admin can update max/windowMs at runtime
export const rateLimitConfig = {
  max: 500,
  windowMs: 15 * 60 * 1000,
  whitelist: ['103.208.68.211', '127.0.0.1', '::1', '::ffff:127.0.0.1']
};

// Use MemoryStore directly so we can call resetAll() from admin route
import { MemoryStore } from 'express-rate-limit';
export const rateLimitStore = new MemoryStore();

// ── Blocked IP log (in-memory, max 200 entries) ──────────────────────────
export const blockedIPLog = [];

// ── Custom IP Request Tracker (reliable across all package versions) ─────
export const ipRequestTracker = {};

export const resetTrackerIP = (ip) => {
  if (ipRequestTracker[ip]) {
    ipRequestTracker[ip].count = 0;
  }
};

export const resetAllTrackerIPs = () => {
  Object.keys(ipRequestTracker).forEach(ip => {
    ipRequestTracker[ip].count = 0;
  });
};

let trackerResetInterval;
export const startTrackerResetTimer = () => {
  if (trackerResetInterval) clearInterval(trackerResetInterval);
  trackerResetInterval = setInterval(() => {
    resetAllTrackerIPs();
    console.log('[RateLimit] Custom request tracker counts reset for new window');
  }, rateLimitConfig.windowMs);
};
startTrackerResetTimer();

const getRealIP = (req) => {
  // X-Forwarded-For may contain a chain: "clientIP, proxy1, proxy2"
  // First entry is always the real client IP
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

// IP Request tracking middleware
const trackIpRequests = (req, res, next) => {
  const realIP = getRealIP(req);
  if (!ipRequestTracker[realIP]) {
    ipRequestTracker[realIP] = { count: 0, lastRoute: '', lastTime: '' };
  }
  
  const isWhitelisted = (rateLimitConfig.whitelist || []).includes(realIP);
  if (!isWhitelisted) {
    ipRequestTracker[realIP].count += 1;
  }
  
  ipRequestTracker[realIP].lastRoute = req.originalUrl;
  ipRequestTracker[realIP].lastTime = new Date().toISOString();
  next();
};

const globalLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: (req) => rateLimitConfig.max,
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore,
  keyGenerator: (req) => getRealIP(req), // ← track each user by their real IP
  skip: (req) => {
    const realIP = getRealIP(req);
    return rateLimitConfig.whitelist.includes(realIP);
  },
  message: { success: false, message: 'Too many requests, please try again later.' },
  handler: (req, res, next, options) => {
    const realIP = getRealIP(req);
    const entry  = { ip: realIP, route: req.originalUrl, time: new Date().toISOString() };
    blockedIPLog.unshift(entry);
    if (blockedIPLog.length > 200) blockedIPLog.pop();
    
    // Explicitly make sure count is at max limit in tracker too
    if (ipRequestTracker[realIP]) {
      ipRequestTracker[realIP].count = Math.max(ipRequestTracker[realIP].count, rateLimitConfig.max);
    }
    
    console.warn(`🚫 RATE LIMIT BLOCKED | IP: ${realIP} | Route: ${req.originalUrl} | Time: ${entry.time}`);
    res.status(options.statusCode).json(options.message);
  },
});

app.use('/api/', trackIpRequests, globalLimiter);


// ── CORS ────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',        // React dev server
  'http://localhost:8888',        // Local backend
  'https://nilex.in',             // Production custom domain
  'https://www.nilex.in',         // Production custom domain (www)
  process.env.CLIENT_URL,         // Frontend URL — set in Render dashboard env vars
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any *.onrender.com subdomain (covers all Render-hosted frontends)
    if (origin.endsWith('.onrender.com')) return callback(null, true);
    // Allow explicitly whitelisted origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());

// ── Database ────────────────────────────────────────
dbConnect();

// ── API Routes ──────────────────────────────────────
app.use('/api/users', userRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/products',   productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/bills',      billRoutes);
app.use('/api/customers',  customerRoutes);
app.use('/api/ai',         aiRoutes);
app.use('/api/auth',       authRoutes);
app.use('/api/admin',      adminRoutes);

// ── Health check ────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'UserBase API is running',
    db: 'connected',
    timestamp: new Date().toISOString(),
  });
});

// ── API 404 ─────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: `API route ${req.originalUrl} not found` });
});

// ── Root ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'UserBase API is running 🚀',
    endpoints: {
      health:   '/health',
      users:    '/api/users',
      products: '/api/products',
      payment:  '/api/payment',
    },
  });
});

// ── Global error handler ────────────────────────────
app.use(errorHandler);

// ── Start server ─────────────────────────────────────
// Render requires the server to bind to 0.0.0.0, not just localhost
const PORT = process.env.PORT || 8888;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀  Backend API    →  http://0.0.0.0:${PORT}/api/users`);
  console.log(`📋  Health check   →  http://0.0.0.0:${PORT}/health\n`);
});
