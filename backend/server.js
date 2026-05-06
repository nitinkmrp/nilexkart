import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import dbConnect from './config/db.js';
import userRoutes from './routes/user.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import waitlistRoutes from './routes/waitlist.routes.js';
import productRoutes    from './routes/products.routes.js';
import categoryRoutes  from './routes/categories.routes.js';
import billRoutes      from './routes/bills.routes.js';
import customerRoutes  from './routes/customers.routes.js';
import aiRoutes        from './routes/ai.routes.js';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// ── CORS ────────────────────────────────────────────
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
