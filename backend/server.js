import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dbConnect from './config/db.js';
import userRoutes from './routes/user.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import waitlistRoutes from './routes/waitlist.routes.js';
import productRoutes from './routes/products.routes.js';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

// ── CORS ────────────────────────────────────────────
// Allow React dev server (port 3000) AND production same-origin
const allowedOrigins = [
  'https://final-projectfrontend.onrender.com/',   // React dev server
  'https://final-project1-d3iz.onrender.com/users',   // Same-origin (production build)
  process.env.CLIENT_URL,    // Optional: set in .env for deployment
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, mobile)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());

// ── Serve React production build ─────────────────────
// Only used when you run: npm run build  inside the React project
// and copy the build/ folder next to backend/
const reactBuildPath = path.join(__dirname, '../react-build');
app.use(express.static(reactBuildPath));

// ── Serve uploaded product images ────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Database ────────────────────────────────────────
dbConnect();

// ── API Routes ──────────────────────────────────────
app.use('/api/users', userRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/products', productRoutes);

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

// ── React fallback (for production build) ───────────
app.get('*', (req, res) => {
  const indexPath = path.join(reactBuildPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // React build not found — just return API info
      res.status(200).json({
        message: 'UserBase API is running. Start React dev server on port 3000.',
        api: `http://localhost:${process.env.PORT || 8888}/api/users`,
      });
    }
  });
});

// ── Global error handler ────────────────────────────
app.use(errorHandler);

// ── Start server ────────────────────────────────────
const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`\n🚀  Backend API    →  http://localhost:${PORT}/api/users`);
  console.log(`🌐  React dev      →  http://localhost:3000  (run: npm start)`);
  console.log(`📋  Health check   →  http://localhost:${PORT}/health\n`);
});
