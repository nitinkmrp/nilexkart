import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Get the User model (assuming it's already defined by user.routes.js, but to be safe we grab it from models)
const User = mongoose.models.User;

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // In a real production app, password should be hashed and compared with bcrypt.
    // However, sticking to the existing architecture where passwords are plain text:
    const user = await User.findOne({ email });
    
    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Determine the secret (fallback to ADMIN_SECRET_KEY for backward compatibility during transition)
    const secret = process.env.JWT_SECRET || process.env.ADMIN_SECRET_KEY || 'default_fallback_secret';
    
    // Sign the token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        role: user.role 
      },
      secret,
      { expiresIn: '7d' } // Token expires in 7 days
    );

    // Don't send password back to the client
    const { password: _, ...safeUser } = user.toObject();

    res.json({
      success: true,
      data: safeUser,
      token
    });
    
  } catch (err) {
    next(err);
  }
});

export default router;
