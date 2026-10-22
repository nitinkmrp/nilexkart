import express from 'express';
import mongoose from 'mongoose';
import { Waitlist } from '../models/index.js';

const router = express.Router();

// ── GET /api/waitlist/:email — fetch all waitlist items for a user ──
router.get('/:email', async (req, res, next) => {
  try {
    const items = await Waitlist.find({ userEmail: req.params.email }).sort({ createdAt: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/waitlist — add a product to the user's waitlist ──
router.post('/', async (req, res, next) => {
  try {
    const { userEmail, productId, productName, productImage, price, status } = req.body;
    if (!userEmail || !productId || !productName) {
      return res.status(400).json({ success: false, message: 'userEmail, productId, and productName are required' });
    }

    const existing = await Waitlist.findOne({ userEmail, productId });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Product already in your waitlist' });
    }

    const item = await Waitlist.create({ userEmail, productId, productName, productImage, price, status });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/waitlist/:email/:productId — remove a product from waitlist ──
router.delete('/:email/:productId', async (req, res, next) => {
  try {
    const item = await Waitlist.findOneAndDelete({
      userEmail: req.params.email,
      productId: req.params.productId,
    });
    if (!item) return res.status(404).json({ success: false, message: 'Waitlist item not found' });
    res.json({ success: true, message: 'Removed from waitlist' });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/waitlist/:email/:productId/status — update stock status ──
router.patch('/:email/:productId/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Out of Stock', 'Back in Stock'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }
    const item = await Waitlist.findOneAndUpdate(
      { userEmail: req.params.email, productId: req.params.productId },
      { $set: { status } },
      { new: true }
    );
    if (!item) return res.status(404).json({ success: false, message: 'Waitlist item not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

export default router;
