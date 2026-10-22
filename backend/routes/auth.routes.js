import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User, Otp } from '../models/index.js';
import { isAllowedDomain, generateOtp } from '../utils/authHelpers.js';
import { sendAuthEmail } from '../utils/emailService.js';

const router = express.Router();

// ── Rate Limiters ────────────────────────────────────────────
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15,                   // max 15 OTP requests per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests. Please wait a while before trying again.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,                   // max 15 login attempts per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
});

// Reference centralized User model
const getUserModel = () => User;


// ── Login route (rate limited: 15 attempts per 15 min) ───────
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const User = getUserModel();
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    // Support both bcrypt hashed passwords (OTP registered) and legacy plaintext
    let passwordMatch = false;
    if (user.password.startsWith('$2')) {
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      passwordMatch = user.password === password;
    }
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const secret = process.env.JWT_SECRET || process.env.ADMIN_SECRET_KEY || 'default_fallback_secret';
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      secret,
      { expiresIn: '7d' }
    );
    const { password: _, ...safeUser } = user.toObject();
    res.json({ success: true, data: safeUser, token });
  } catch (err) {
    next(err);
  }
});

// ── Email OTP registration - step 1: request OTP (rate limited) ─
router.post('/register', otpLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!isAllowedDomain(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Only Gmail, Yahoo, and Outlook emails are allowed.' });
    }
    const User = getUserModel();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User already registered.' });
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await Otp.findOneAndUpdate(
      { email: cleanEmail, purpose: 'register' },
      { otpHash, expiresAt },
      { upsert: true, new: true }
    );

    await sendAuthEmail(cleanEmail, otp, 'register');

    res.json({ success: true, message: 'OTP sent to email.' });
  } catch (err) {
    next(err);
  }
});

// ── Generic Resend OTP endpoint (for register & forgot_password) ─
router.post('/resend-otp', otpLimiter, async (req, res, next) => {
  try {
    const { email, purpose = 'register' } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!isAllowedDomain(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Only Gmail, Yahoo, and Outlook emails are allowed.' });
    }

    const User = getUserModel();
    const user = await User.findOne({ email: cleanEmail });

    if (purpose === 'register' && user) {
      return res.status(409).json({ success: false, message: 'User already registered. Please log in.' });
    }
    if (purpose === 'forgot_password' && !user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address.' });
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await Otp.findOneAndUpdate(
      { email: cleanEmail, purpose },
      { otpHash, expiresAt },
      { upsert: true, new: true }
    );

    await sendAuthEmail(cleanEmail, otp, purpose);

    res.json({ success: true, message: 'New OTP has been sent to your email.' });
  } catch (err) {
    next(err);
  }
});

// ── Email OTP verification - step 2: verify and create account ─
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, otp, password, name } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and password are required' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const otpRecord = await Otp.findOne({ email: cleanEmail, purpose: 'register' });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'OTP not requested or already used.' });
    }
    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ email: cleanEmail, purpose: 'register' });
      return res.status(410).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }
    const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid OTP code.' });
    }

    const User = getUserModel();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      await Otp.deleteOne({ email: cleanEmail, purpose: 'register' });
      return res.status(409).json({ success: false, message: 'Account already exists. Please log in.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userName = name && name.trim() ? name.trim() : cleanEmail.split('@')[0];
    const user = await User.create({ email: cleanEmail, password: passwordHash, name: userName });
    
    await Otp.deleteOne({ email: cleanEmail, purpose: 'register' });
    
    const secret = process.env.JWT_SECRET || process.env.ADMIN_SECRET_KEY || 'default_fallback_secret';
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      secret,
      { expiresIn: '7d' }
    );
    const { password: _, ...safeUser } = user.toObject();
    res.json({ success: true, data: safeUser, token, message: 'Account created successfully!' });
  } catch (err) {
    next(err);
  }
});

// ── Forgot Password - step 1: request reset OTP ─────────────
router.post('/forgot-password', otpLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!isAllowedDomain(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Only Gmail, Yahoo, and Outlook emails are allowed.' });
    }

    const User = getUserModel();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address.' });
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await Otp.findOneAndUpdate(
      { email: cleanEmail, purpose: 'forgot_password' },
      { otpHash, expiresAt },
      { upsert: true, new: true }
    );

    await sendAuthEmail(cleanEmail, otp, 'forgot_password');

    res.json({ success: true, message: 'Password reset code sent to your email.' });
  } catch (err) {
    next(err);
  }
});

// ── Reset Password - step 2: verify OTP & set new password ───
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const otpRecord = await Otp.findOne({ email: cleanEmail, purpose: 'forgot_password' });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Reset code not found or already used. Please request a new code.' });
    }
    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ email: cleanEmail, purpose: 'forgot_password' });
      return res.status(410).json({ success: false, message: 'Reset code expired. Please request a new code.' });
    }

    const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid OTP reset code.' });
    }

    const User = getUserModel();
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updatedUser = await User.findOneAndUpdate(
      { email: cleanEmail },
      { password: passwordHash },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await Otp.deleteOne({ email: cleanEmail, purpose: 'forgot_password' });

    res.json({ success: true, message: 'Password reset successful! You can now log in with your new password.' });
  } catch (err) {
    next(err);
  }
});

export default router;

