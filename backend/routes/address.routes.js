import express from 'express';
import mongoose from 'mongoose';
import { Address } from '../models/index.js';

const router = express.Router();

// GET /api/address — fetch addresses for a user or customer
router.get('/', async (req, res, next) => {
  try {
    const { email, userId, customerId } = req.query;
    const filter = {};
    if (userId && mongoose.isValidObjectId(userId)) filter.userId = userId;
    if (customerId && mongoose.isValidObjectId(customerId)) filter.customerId = customerId;
    if (email) filter.userEmail = email.toLowerCase().trim();

    if (!filter.userId && !filter.customerId && !filter.userEmail) {
      return res.status(400).json({ success: false, message: 'Please provide email or userId' });
    }

    const addresses = await Address.find(filter).sort({ isDefault: -1, createdAt: -1 });
    res.json({ success: true, count: addresses.length, data: addresses });
  } catch (err) {
    next(err);
  }
});

// GET /api/address/:id — fetch single address
router.get('/:id', async (req, res, next) => {
  try {
    const address = await Address.findById(req.params.id);
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    res.json({ success: true, data: address });
  } catch (err) {
    next(err);
  }
});

// POST /api/address — create new address
router.post('/', async (req, res, next) => {
  try {
    const {
      userId,
      customerId,
      userEmail,
      label = 'home',
      fullName,
      phone,
      line1,
      line2 = '',
      landmark = '',
      city,
      state,
      pincode,
      country = 'IN',
      isDefault = false,
    } = req.body;

    if (!fullName || !phone || !line1 || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'fullName, phone, line1, city, state, and pincode are required',
      });
    }

    // If setting as default, unset other defaults for this user
    if (isDefault) {
      const matchCriteria = {};
      if (userId) matchCriteria.userId = userId;
      if (userEmail) matchCriteria.userEmail = userEmail.toLowerCase().trim();
      if (Object.keys(matchCriteria).length > 0) {
        await Address.updateMany(matchCriteria, { $set: { isDefault: false } });
      }
    }

    const address = await Address.create({
      userId: userId && mongoose.isValidObjectId(userId) ? userId : null,
      customerId: customerId && mongoose.isValidObjectId(customerId) ? customerId : null,
      userEmail: userEmail ? userEmail.toLowerCase().trim() : '',
      label,
      fullName,
      phone,
      line1,
      line2,
      landmark,
      city,
      state,
      pincode,
      country,
      isDefault: Boolean(isDefault),
    });

    res.status(201).json({ success: true, message: 'Address saved successfully', data: address });
  } catch (err) {
    next(err);
  }
});

// PUT /api/address/:id — update existing address
router.put('/:id', async (req, res, next) => {
  try {
    const addressId = req.params.id;
    const updates = { ...req.body };

    if (updates.isDefault) {
      const current = await Address.findById(addressId);
      if (current) {
        const matchCriteria = {};
        if (current.userId) matchCriteria.userId = current.userId;
        if (current.userEmail) matchCriteria.userEmail = current.userEmail;
        if (Object.keys(matchCriteria).length > 0) {
          await Address.updateMany(matchCriteria, { $set: { isDefault: false } });
        }
      }
    }

    const updated = await Address.findByIdAndUpdate(addressId, { $set: updates }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    res.json({ success: true, message: 'Address updated successfully', data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/address/:id — delete address
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Address.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    res.json({ success: true, message: 'Address removed successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
