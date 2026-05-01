import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// ── Waitlist Schema ─────────────────────────────────
const waitlistSchema = new mongoose.Schema(
  {
    userEmail:   { type: String, required: true, lowercase: true, trim: true },
    productId:   { type: String, required: true },
    productName: { type: String, required: true },
    productImage:{ type: String, default: '' },
    price:       { type: Number, default: 0 },
    status:      { type: String, enum: ['Out of Stock', 'Back in Stock'], default: 'Out of Stock' },
  },
  { timestamps: true }
);

// Prevent duplicate entries for same user + product
waitlistSchema.index({ userEmail: 1, productId: 1 }, { unique: true });

const Waitlist = mongoose.models.Waitlist || mongoose.model('Waitlist', waitlistSchema);

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
