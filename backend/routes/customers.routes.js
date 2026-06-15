import express from 'express';
import mongoose from 'mongoose';
import roleGuard from '../middleware/roleGuard.js';

const router = express.Router();

// ── Customer Profile Schema ────────────────────────────
const customerSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, trim: true },
    mobile:  { type: String, required: true, trim: true },
    email:   { type: String, default: '', trim: true, lowercase: true },
    address: { type: String, default: '' },
    notes:   { type: String, default: '' },
  },
  { timestamps: true }
);

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

// Re-use the Bill model (already registered in bills.routes.js)
// We read it lazily so that registration order doesn't matter
const getBillModel = () => mongoose.models.Bill;

// ── GET /api/customers — list all customers ─────────────
router.get('/', roleGuard(['admin', 'editor', 'support']), async (req, res, next) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { name:   { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email:  { $regex: search, $options: 'i' } },
      ];
    }
    const customers = await Customer.find(filter).sort({ createdAt: -1 });

    // Attach aggregate bill stats per customer
    const Bill = getBillModel();
    const enriched = await Promise.all(
      customers.map(async (c) => {
        const obj = c.toObject();
        if (Bill) {
          const bills = await Bill.find({ customerPhone: c.mobile }).sort({ txnDate: -1 });
          obj.totalSpend   = bills.reduce((s, b) => s + (b.txnType === 'give' ? -b.amount : b.amount), 0);
          obj.txnCount     = bills.length;
          obj.lastTxnDate  = bills[0]?.txnDate || null;
        } else {
          obj.totalSpend = 0; obj.txnCount = 0; obj.lastTxnDate = null;
        }
        return obj;
      })
    );

    res.json({ success: true, count: customers.length, data: enriched });
  } catch (err) { next(err); }
});

// ── GET /api/customers/:id — single customer ────────────
router.get('/:id', roleGuard(['admin', 'editor', 'support']), async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (err) { next(err); }
});

// ── GET /api/customers/:id/timeline — txn timeline ──────
router.get('/:id/timeline', roleGuard(['admin', 'editor', 'support']), async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const Bill = getBillModel();
    if (!Bill) return res.json({ success: true, data: { customer, bills: [] } });

    // Match by phone (primary) OR email (fallback) if provided
    const orClauses = [{ customerPhone: customer.mobile }];
    if (customer.email) orClauses.push({ customerEmail: customer.email });

    const bills = await Bill.find({ $or: orClauses }).sort({ txnDate: -1 });
    const totalSpend = bills.reduce((s, b) => s + (b.txnType === 'give' ? -b.amount : b.amount), 0);

    res.json({ success: true, data: { customer, bills, totalSpend } });
  } catch (err) { next(err); }
});

// ── POST /api/customers — create customer ───────────────
router.post('/', roleGuard(['admin', 'editor', 'support']), async (req, res, next) => {
  try {
    const { name, mobile, email, address, notes } = req.body;
    if (!name || !mobile) {
      return res.status(400).json({ success: false, message: 'name and mobile are required' });
    }
    const customer = await Customer.create({ name, mobile, email, address, notes });
    res.status(201).json({ success: true, data: customer });
  } catch (err) { next(err); }
});

// ── PUT /api/customers/:id — update customer ────────────
router.put('/:id', roleGuard(['admin', 'editor', 'support']), async (req, res, next) => {
  try {
    const { name, mobile, email, address, notes } = req.body;
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: { name, mobile, email, address, notes } },
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (err) { next(err); }
});

// ── DELETE /api/customers/:id ───────────────────────────
router.delete('/:id', roleGuard(['admin']), async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, message: 'Customer deleted' });
  } catch (err) { next(err); }
});

export default router;
