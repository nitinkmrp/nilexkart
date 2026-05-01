import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Uploads folder ──────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── Multer config (disk storage) ────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp|gif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── Product Schema ──────────────────────────────────
const productSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true, trim: true },
    category:    { type: String, required: true, trim: true },
    price:       { type: Number, required: true, min: 0 },
    discount:    { type: Number, default: 0, min: 0, max: 100 },
    stock:       { type: Number, default: 0, min: 0 },
    shortDesc:   { type: String, default: '' },
    description: { type: String, default: '' },
    imgUrl:      { type: String, default: '' },
    avgRating:   { type: Number, default: 0 },
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

// ── POST /api/products — create product (with optional image) ──
router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    const { productName, category, price, discount, stock, shortDesc, description, avgRating } = req.body;
    if (!productName || !category || price === undefined) {
      return res.status(400).json({ success: false, message: 'productName, category, and price are required' });
    }

    let imgUrl = req.body.imgUrl || '';
    if (req.file) {
      imgUrl = `/uploads/${req.file.filename}`;
    }

    const product = await Product.create({
      productName, category,
      price: Number(price),
      discount: Number(discount || 0),
      stock: Number(stock || 0),
      shortDesc, description,
      imgUrl,
      avgRating: Number(avgRating || 0),
    });
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
});

// ── PUT /api/products/:id — update product (with optional new image) ──
router.put('/:id', upload.single('image'), async (req, res, next) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

    const updates = { ...req.body };
    if (updates.price)    updates.price    = Number(updates.price);
    if (updates.discount) updates.discount = Number(updates.discount);
    if (updates.stock)    updates.stock    = Number(updates.stock);
    if (updates.avgRating) updates.avgRating = Number(updates.avgRating);

    if (req.file) {
      // Delete old uploaded image if it exists
      if (existing.imgUrl && existing.imgUrl.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '..', existing.imgUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updates.imgUrl = `/uploads/${req.file.filename}`;
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

// ── PATCH /api/products/:id/stock — update stock only ──
router.patch('/:id/stock', async (req, res, next) => {
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

// ── DELETE /api/products/:id ─────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    // Clean up uploaded image
    if (product.imgUrl && product.imgUrl.startsWith('/uploads/')) {
      const imgPath = path.join(__dirname, '..', product.imgUrl);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) { next(err); }
});

export default router;
