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
};

// Use MemoryStore directly so we can call resetAll() from admin route
import { MemoryStore } from 'express-rate-limit';
export const rateLimitStore = new MemoryStore();

const globalLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: (req) => rateLimitConfig.max,          // dynamic — reads config on every request
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);


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
