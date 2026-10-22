import express from 'express';
import mongoose from 'mongoose';
import { upload, cloudinary } from '../config/cloudinary.js';
import roleGuard from '../middleware/roleGuard.js';
import { Bill, Customer } from '../models/index.js';

const router = express.Router();

// ── GET /api/bills — list all bills ─────────────────────
router.get('/', roleGuard(['admin', 'editor', 'support']), async (req, res, next) => {
  try {
    const { status, method, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (method) filter.paymentMethod = method;
    if (search) {
      filter.$or = [
        { customerName:  { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
        { txnId:         { $regex: search, $options: 'i' } },
      ];
    }
    const bills = await Bill.find(filter).sort({ txnDate: -1 });
    const total = bills.reduce((s, b) => s + (b.txnType === 'give' ? -b.amount : b.amount), 0);
    res.json({ success: true, count: bills.length, totalRevenue: total, data: bills });
  } catch (err) { next(err); }
});

// ── GET /api/bills/:id ────────────────────────────────────
router.get('/:id', roleGuard(['admin', 'editor', 'support']), async (req, res, next) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
    res.json({ success: true, data: bill });
  } catch (err) { next(err); }
});

// ── POST /api/bills — create bill (admin only) ─────────────
router.post('/', roleGuard(['admin', 'editor', 'support']), upload.single('receipt'), async (req, res, next) => {
  try {
    const {
      customerName, customerEmail, customerPhone,
      txnId, amount, txnType, paymentMethod, status,
      items, receivedBy, notes, txnDate,
    } = req.body;

    if (!customerName || !amount) {
      return res.status(400).json({ success: false, message: 'customerName and amount are required' });
    }

    let receiptUrl = '';
    let receiptPublicId = '';
    if (req.file) {
      receiptUrl      = req.file.path;
      receiptPublicId = req.file.filename;
    }

    let parsedItems = [];
    try { parsedItems = items ? JSON.parse(items) : []; } catch (_) {}

    const bill = await Bill.create({
      customerName, customerEmail: customerEmail || '', customerPhone,
      txnId, amount: Number(amount),
      txnType: txnType || 'receive',
      paymentMethod: paymentMethod || 'cash',
      status:        status || 'paid',
      items:         parsedItems,
      receivedBy,    notes,
      receiptUrl,    receiptPublicId,
      txnDate:       txnDate ? new Date(txnDate) : new Date(),
    });
    res.status(201).json({ success: true, data: bill });
  } catch (err) { next(err); }
});

// ── PUT /api/bills/:id — update bill ──────────────────────
router.put('/:id', roleGuard(['admin', 'editor', 'support']), upload.single('receipt'), async (req, res, next) => {
  try {
    const existing = await Bill.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Bill not found' });

    const updates = { ...req.body };
    if (updates.amount) updates.amount = Number(updates.amount);
    if (updates.txnDate) updates.txnDate = new Date(updates.txnDate);
    if (updates.items) {
      try { updates.items = JSON.parse(updates.items); } catch (_) { delete updates.items; }
    }

    if (req.file) {
      if (existing.receiptPublicId) {
        try { await cloudinary.uploader.destroy(existing.receiptPublicId); } catch (_) {}
      }
      updates.receiptUrl      = req.file.path;
      updates.receiptPublicId = req.file.filename;
    }

    const bill = await Bill.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: bill });
  } catch (err) { next(err); }
});

// ── PATCH /api/bills/:id/authorize — authorize cash payment ──
router.patch('/:id/authorize', roleGuard(['admin', 'editor']), async (req, res, next) => {
  try {
    const { authorizedBy, authorize } = req.body;
    const doAuthorize = authorize !== false; // default to true

    const bill = await Bill.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          cashAuthorized:   doAuthorize,
          cashAuthorizedBy: doAuthorize ? (authorizedBy || 'Admin') : '',
          cashAuthorizedAt: doAuthorize ? new Date() : null,
          status:           doAuthorize ? 'authorized' : 'pending',
        },
      },
      { new: true }
    );
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
    res.json({ success: true, data: bill, message: doAuthorize ? 'Cash payment authorized' : 'Authorization revoked' });
  } catch (err) { next(err); }
});

// ── DELETE /api/bills/:id ──────────────────────────────────
router.delete('/:id', roleGuard(['admin']), async (req, res, next) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
    if (bill.receiptPublicId) {
      try { await cloudinary.uploader.destroy(bill.receiptPublicId); } catch (_) {}
    }
    res.json({ success: true, message: 'Bill deleted' });
  } catch (err) { next(err); }
});

export default router;
