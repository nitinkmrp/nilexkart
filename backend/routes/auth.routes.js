import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import Otp from '../models/Otp.js';
import { isAllowedDomain, generateOtp } from '../utils/authHelpers.js';

const router = express.Router();

// Get the User model (assuming it's already defined)
const User = mongoose.models.User;

// Existing login route
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
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

// Email OTP registration - step 1: request OTP
router.post('/register', async (req, res, next) => {
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
