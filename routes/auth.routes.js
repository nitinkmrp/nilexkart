import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import Otp from '../models/Otp.js';
import { isAllowedDomain, generateOtp } from '../utils/authHelpers.js';

const router = express.Router();

// ── Rate Limiters ────────────────────────────────────────────
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // max 5 OTP requests per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests. Please wait 1 hour before trying again.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 login attempts per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
});


// Get the User model (assuming it's already defined)
const User = mongoose.models.User;

// Login route (rate limited: 10 attempts per 15 min)
router.post('/login', loginLimiter, async (req, res, next) => {

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    // Support both bcrypt hashed passwords (OTP registered) and legacy plaintext
    let passwordMatch = false;
    if (user.password.startsWith('$2')) {
      // bcrypt hash — use compare
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      // Legacy plaintext comparison (for admin/seeded users)
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


// Email OTP registration - step 1: request OTP (rate limited: 5/hour)
router.post('/register', otpLimiter, async (req, res, next) => {

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    if (!isAllowedDomain(email)) {
      return res.status(400).json({ success: false, message: 'Only Gmail, Yahoo, Outlook emails are allowed.' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User already registered.' });
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await Otp.findOneAndUpdate(
      { email },
      { otpHash, expiresAt },
      { upsert: true, new: true }
    );

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"${process.env.APP_NAME}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your registration OTP',
      html: `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`,
    });

    res.json({ success: true, message: 'OTP sent to email.' });
  } catch (err) {
    next(err);
  }
});

// Email OTP verification - step 2: verify and create account
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;
    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'OTP not requested.' });
    }
    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ email });
      return res.status(410).json({ success: false, message: 'OTP expired.' });
    }
    const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid OTP.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password: passwordHash, name: email.split('@')[0] });
    await Otp.deleteOne({ email });
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

export default router;
