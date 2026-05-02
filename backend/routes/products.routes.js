import express from 'express';
import mongoose from 'mongoose';
import { upload, cloudinary } from '../config/cloudinary.js';
import adminKeyGuard from '../middleware/adminKeyGuard.js';

const router = express.Router();

// ── Product Schema ──────────────────────────────────
const productSchema = new mongoose.Schema(
  {
    productName:  { type: String, required: true, trim: true },
    category:     { type: String, required: true, trim: true },
    price:        { type: Number, required: true, min: 0 },
    discount:     { type: Number, default: 0, min: 0, max: 100 },
    stock:        { type: Number, default: 0, min: 0 },
    shortDesc:    { type: String, default: '' },
    description:  { type: String, default: '' },
    imgUrl:       { type: String, default: '' },   // full Cloudinary HTTPS URL
    publicId:     { type: String, default: '' },   // Cloudinary public_id for deletion
    avgRating:    { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

// ── GET /api/products — list all products ───────────
router.get('/', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    let filter = {};
    if (category) filter.category = category;
    if (search)   filter.productName = { $regex: search, $options: 'i' };
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: products.length, data: products });
  } catch (err) { next(err); }
});

// ── GET /api/products/:id ────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

// ── POST /api/products — create product (admin only) ──
router.post('/', adminKeyGuard, upload.single('image'), async (req, res, next) => {
  try {
    const { productName, category, price, discount, stock, shortDesc, description, avgRating, imgUrl: bodyImgUrl } = req.body;

    if (!productName || !category || price === undefined) {
      return res.status(400).json({ success: false, message: 'productName, category, and price are required' });
    }

    // Prefer uploaded file (Cloudinary), fall back to a pasted URL
    let imgUrl  = bodyImgUrl || '';
    let publicId = '';
    if (req.file) {
      imgUrl   = req.file.path;        // Cloudinary HTTPS URL
      publicId = req.file.filename;    // Cloudinary public_id
    }

    const product = await Product.create({
      productName, category,
      price:      Number(price),
      discount:   Number(discount  || 0),
      stock:      Number(stock     || 0),
      shortDesc,  description,
      imgUrl,     publicId,
      avgRating:  Number(avgRating || 0),
    });
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
});

// ── PUT /api/products/:id — update product (admin only) ──
router.put('/:id', adminKeyGuard, upload.single('image'), async (req, res, next) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

    const updates = { ...req.body };
    if (updates.price)     updates.price     = Number(updates.price);
    if (updates.discount)  updates.discount  = Number(updates.discount);
    if (updates.stock)     updates.stock     = Number(updates.stock);
    if (updates.avgRating) updates.avgRating = Number(updates.avgRating);

    if (req.file) {
      // Delete old Cloudinary image if it was uploaded (has a publicId)
      if (existing.publicId) {
        try { await cloudinary.uploader.destroy(existing.publicId); } catch (_) {}
      }
      updates.imgUrl   = req.file.path;      // new Cloudinary HTTPS URL
      updates.publicId = req.file.filename;  // new Cloudinary public_id
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

// ── PATCH /api/products/:id/stock — update stock (admin only) ──
router.patch('/:id/stock', adminKeyGuard, async (req, res, next) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || stock < 0) {
      return res.status(400).json({ success: false, message: 'Valid stock value required' });
    }
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: { stock: Number(stock) } },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

// ── DELETE /api/products/:id (admin only) ──────────────────
router.delete('/:id', adminKeyGuard, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Delete image from Cloudinary if it was cloud-hosted
    if (product.publicId) {
      try { await cloudinary.uploader.destroy(product.publicId); } catch (_) {}
    }
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) { next(err); }
});

export default router;
