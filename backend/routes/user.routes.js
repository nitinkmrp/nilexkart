import express from 'express';
import mongoose from 'mongoose';
import roleGuard from '../middleware/roleGuard.js';

const router = express.Router();

// ── User Schema (inline for simplicity) ─────────────
const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['user', 'admin', 'editor', 'support'], default: 'user' },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

// ── GET all users (admin only) ───────────────────────
router.get('/', roleGuard(['admin']), async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
});

// ── GET user by email ────────────────────────────────
router.get('/:email', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ── POST create user ─────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ success: false, message: 'Email already registered' });
    const user = await User.create({ name, email, password, role });
    const { password: _, ...safeUser } = user.toObject();
    res.status(201).json({ success: true, data: safeUser });
  } catch (err) {
    next(err);
  }
});

// ── PUT update user (admin only) ─────────────────────
router.put('/:email', roleGuard(['admin']), async (req, res, next) => {
  try {
    const user = await User.findOneAndUpdate(
      { email: req.params.email },
      { $set: req.body },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ── DELETE user (admin only) ──────────────────────────
router.delete('/:email', roleGuard(['admin']), async (req, res, next) => {
  try {
    const user = await User.findOneAndDelete({ email: req.params.email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;