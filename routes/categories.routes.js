import express from 'express';
import mongoose from 'mongoose';
import roleGuard from '../middleware/roleGuard.js';

const router = express.Router();

// ── Category Schema ──────────────────────────────────
const categorySchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, unique: true },
    slug:        { type: String, required: true, trim: true, unique: true, lowercase: true },
    description: { type: String, default: '' },
    icon:        { type: String, default: '📦' },   // emoji or icon class
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

// ── GET /api/categories — list all categories ────────
router.get('/', async (req, res, next) => {
  try {
    const { active } = req.query;
    const filter = {};
    if (active === 'true')  filter.isActive = true;
    if (active === 'false') filter.isActive = false;
    const categories = await Category.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: categories.length, data: categories });
  } catch (err) { next(err); }
});

// ── GET /api/categories/:id ──────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, data: category });
  } catch (err) { next(err); }
});

// ── POST /api/categories — create category (admin only) ──
router.post('/', roleGuard(['admin', 'editor']), async (req, res, next) => {
  try {
    const { name, description, icon, isActive } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });

    // Auto-generate slug from name
    const slug = req.body.slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const category = await Category.create({
      name, slug, description, icon,
      isActive: isActive !== undefined ? isActive : true,
    });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Category name or slug already exists' });
    }
    next(err);
  }
});

// ── PUT /api/categories/:id — update category (admin only) ──
router.put('/:id', roleGuard(['admin', 'editor']), async (req, res, next) => {
  try {
    const { name, description, icon, isActive } = req.body;
    const updates = {};
    if (name        !== undefined) updates.name        = name;
    if (description !== undefined) updates.description = description;
    if (icon        !== undefined) updates.icon        = icon;
    if (isActive    !== undefined) updates.isActive    = isActive;
    if (name) updates.slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, data: category });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Category name or slug already exists' });
    }
    next(err);
  }
});

// ── DELETE /api/categories/:id (admin only) ──────────
router.delete('/:id', roleGuard(['admin', 'editor']), async (req, res, next) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) { next(err); }
});

export default router;
