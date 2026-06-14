import express from 'express';
import mongoose from 'mongoose';
import { upload, cloudinary } from '../config/cloudinary.js';
import roleGuard from '../middleware/roleGuard.js';

const router = express.Router();

// ── Product Schema ──────────────────────────────────
const productSchema = new mongoose.Schema(
  {
    productName:  { type: String, required: true, trim: true },
    category:     { type: String, required: true, trim: true },
    sizes:        { type: [String], default: [] },
    sizeStock:    { type: Map, of: Number, default: {} },  // per-size stock e.g. { S:10, M:5 }
    price:        { type: Number, required: true, min: 0 },
    discount:     { type: Number, default: 0, min: 0, max: 100 },
    stock:        { type: Number, default: 0, min: 0 },   // total (auto-sum of sizeStock when set)
    shortDesc:    { type: String, default: '' },
    description:  { type: String, default: '' },
    imgUrl:       { type: String, default: '' },
    publicId:     { type: String, default: '' },
    avgRating:    { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

// ── Stock Movement Schema ───────────────────────────
const stockMovementSchema = new mongoose.Schema(
  {
    productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    changeQty:   { type: Number, required: true }, // positive for addition, negative for deduction
    newStock:    { type: Number, required: true },
    type:        { type: String, enum: ['in', 'out', 'adjustment'], required: true },
    reason:      { type: String, default: 'Manual adjustment' },
    updatedBy:   { type: String, default: 'Admin' },
  },
  { timestamps: true }
);

const StockMovement = mongoose.models.StockMovement || mongoose.model('StockMovement', stockMovementSchema);

const logStockMovement = async (productId, productName, changeQty, newStock, type, reason, updatedBy = 'Admin') => {
  try {
    await StockMovement.create({
      productId,
      productName,
      changeQty,
      newStock,
      type,
      reason,
      updatedBy,
    });
  } catch (err) {
    console.error("Error logging stock movement:", err);
  }
};

// ── GET /api/products/inventory/movements — list all stock movements ───────────
router.get('/inventory/movements', roleGuard(['admin', 'editor']), async (req, res, next) => {
  try {
    const movements = await StockMovement.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: movements });
  } catch (err) { next(err); }
});

// ── GET /api/products/inventory/insights — advanced insights ───────────
router.get('/inventory/insights', roleGuard(['admin', 'editor']), async (req, res, next) => {
  try {
    const products = await Product.find();
    let bills = [];
    try {
      const BillModel = mongoose.models.Bill || mongoose.model('Bill');
      bills = await BillModel.find({ txnType: 'receive', status: 'paid' });
    } catch (e) {
      console.warn("Bill model not registered yet or error querying bills:", e);
    }

    // 1. Calculate general stats
    let totalValuation = 0;
    let totalItems = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    
    const categoryStats = {};

    products.forEach(p => {
      const stock = p.stock || 0;
      const price = p.price || 0;
      const valuation = stock * price;
      totalValuation += valuation;
      totalItems += stock;

      if (stock === 0) outOfStockCount++;
      else if (stock <= 5) lowStockCount++;

      // Category aggregation
      if (!categoryStats[p.category]) {
        categoryStats[p.category] = { totalStock: 0, totalValuation: 0, itemsCount: 0 };
      }
      categoryStats[p.category].totalStock += stock;
      categoryStats[p.category].totalValuation += valuation;
      categoryStats[p.category].itemsCount += 1;
    });

    // 2. Calculate sales velocity over last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const productSalesMap = {}; // productId -> quantity sold in last 30 days
    bills.forEach(bill => {
      const isRecent = new Date(bill.txnDate) >= thirtyDaysAgo;
      if (isRecent && Array.isArray(bill.items)) {
        bill.items.forEach(item => {
          // item may have _id, id, or productName
          const pId = item._id || item.id || item.productName;
          if (pId) {
            const qty = Number(item.qty || item.quantity || 1);
            productSalesMap[pId] = (productSalesMap[pId] || 0) + qty;
            // Also map by lowercase name for fallback
            if (item.name) {
              const nameLower = item.name.toLowerCase();
              productSalesMap[nameLower] = (productSalesMap[nameLower] || 0) + qty;
            }
          }
        });
      }
    });

    // 3. Formulate Actionable Suggestions
    const suggestions = [];
    products.forEach(p => {
      const stock = p.stock || 0;
      const sales = productSalesMap[p._id.toString()] || productSalesMap[p.productName.toLowerCase()] || 0;

      // Rule A: Fast Seller with Low Stock
      if (sales >= 3 && stock <= 5 && stock > 0) {
        suggestions.push({
          productId: p._id,
          productName: p.productName,
          type: 'restock',
          severity: 'high',
          message: `"${p.productName}" is selling fast (${sales} units in last 30 days) but is low on stock (${stock} units left).`,
          recommendation: `Replenish with at least ${Math.max(10, sales * 2)} units immediately to avoid stockout.`,
          estimatedCost: p.price * Math.max(10, sales * 2),
        });
      }
      // Rule B: Dead Stock (No sales, high stock)
      else if (sales === 0 && stock >= 10) {
        const potentialCapital = stock * p.price;
        suggestions.push({
          productId: p._id,
          productName: p.productName,
          type: 'discount',
          severity: 'medium',
          message: `"${p.productName}" has zero sales over the last 30 days with ${stock} units stagnant in warehouse.`,
          recommendation: `Recommend applying a dynamic 15% discount to unlock ₹${potentialCapital.toLocaleString()} of idle capital.`,
          actionDiscount: 15,
          potentialRevenue: potentialCapital * 0.85,
        });
      }
      // Rule C: Out of stock high demand
      else if (stock === 0 && sales >= 1) {
        suggestions.push({
          productId: p._id,
          productName: p.productName,
          type: 'restock',
          severity: 'critical',
          message: `"${p.productName}" is completely Out of Stock but had ${sales} customer purchases recently.`,
          recommendation: `Restock immediately: Recommend order of ${Math.max(15, sales * 2)} units.`,
          estimatedCost: p.price * Math.max(15, sales * 2),
        });
      }
    });

    // If no suggestions, add generic placeholder ones so dashboard looks rich
    if (suggestions.length === 0 && products.length > 0) {
      const firstP = products[0];
      suggestions.push({
        productId: firstP._id,
        productName: firstP.productName,
        type: 'general',
        severity: 'info',
        message: "Inventory health is stable. All items are balanced relative to recent consumer velocity.",
        recommendation: `Maintain regular monitoring. Add dynamic discount offers during holiday seasons to boost sales turnover.`,
      });
    }

    res.json({
      success: true,
      stats: {
        totalValuation,
        totalItems,
        lowStockCount,
        outOfStockCount,
        categoryStats,
      },
      suggestions,
    });
  } catch (err) { next(err); }
});

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
router.post('/', roleGuard(['admin', 'editor']), upload.single('image'), async (req, res, next) => {
  try {
    const { productName, category, sizes, price, discount, stock, sizeStock: rawSizeStock, shortDesc, description, avgRating, imgUrl: bodyImgUrl } = req.body;

    if (!productName || !category || price === undefined) {
      return res.status(400).json({ success: false, message: 'productName, category, and price are required' });
    }

    let imgUrl  = bodyImgUrl || '';
    let publicId = '';
    if (req.file) {
      imgUrl   = req.file.path;
      publicId = req.file.filename;
    }

    const parsedSizes = typeof sizes === 'string' ? sizes.split(',').map(s => s.trim()).filter(Boolean) : (Array.isArray(sizes) ? sizes : []);

    // Parse sizeStock JSON string → object
    let parsedSizeStock = {};
    if (rawSizeStock) {
      try { parsedSizeStock = typeof rawSizeStock === 'string' ? JSON.parse(rawSizeStock) : rawSizeStock; } catch(_) {}
    }

    // Auto-compute total stock from sizeStock if provided
    const sizeStockTotal = Object.values(parsedSizeStock).reduce((s, v) => s + Number(v || 0), 0);
    const totalStock = sizeStockTotal > 0 ? sizeStockTotal : Number(stock || 0);

    const product = await Product.create({
      productName, category,
      sizes:      parsedSizes,
      sizeStock:  parsedSizeStock,
      price:      Number(price),
      discount:   Number(discount  || 0),
      stock:      totalStock,
      shortDesc,  description,
      imgUrl,     publicId,
      avgRating:  Number(avgRating || 0),
    });

    if (product.stock > 0) {
      await logStockMovement(product._id, product.productName, product.stock, product.stock, 'in', 'Initial stock intake');
    }

    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
});

// ── PUT /api/products/:id — update product (admin only) ──
router.put('/:id', roleGuard(['admin', 'editor']), upload.single('image'), async (req, res, next) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

    const oldStock = existing.stock || 0;

    const updates = { ...req.body };
    if (updates.price)     updates.price     = Number(updates.price);
    if (updates.discount !== undefined)  updates.discount  = Number(updates.discount);
    if (updates.stock !== undefined)     updates.stock     = Number(updates.stock);
    if (updates.avgRating) updates.avgRating = Number(updates.avgRating);
    
    if (typeof updates.sizes === 'string') {
      updates.sizes = updates.sizes.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Handle sizeStock JSON
    if (updates.sizeStock) {
      try {
        const ss = typeof updates.sizeStock === 'string' ? JSON.parse(updates.sizeStock) : updates.sizeStock;
        updates.sizeStock = ss;
        // Auto-recalculate total stock
        const total = Object.values(ss).reduce((s, v) => s + Number(v || 0), 0);
        if (total > 0) updates.stock = total;
      } catch(_) { delete updates.sizeStock; }
    }

    if (req.file) {
      if (existing.publicId) {
        try { await cloudinary.uploader.destroy(existing.publicId); } catch (_) {}
      }
      updates.imgUrl   = req.file.path;
      updates.publicId = req.file.filename;
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    const newStock = product.stock || 0;
    if (newStock !== oldStock) {
      const diff = newStock - oldStock;
      const type = diff > 0 ? 'in' : 'out';
      const reason = req.body.reason || (diff > 0 ? 'Restock / Product update' : 'Stock adjustment');
      await logStockMovement(product._id, product.productName, diff, newStock, type, reason, req.body.updatedBy || 'Admin');
    }

    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

// ── PATCH /api/products/:id/stock — update stock (admin only) ──
router.patch('/:id/stock', roleGuard(['admin', 'editor']), async (req, res, next) => {
  try {
    const { stock, sizeStock: rawSizeStock, reason, updatedBy } = req.body;

    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

    const oldStock = existing.stock || 0;
    let newStock = oldStock;
    const dbUpdates = {};

    if (rawSizeStock) {
      // Per-size stock update
      try {
        const ss = typeof rawSizeStock === 'string' ? JSON.parse(rawSizeStock) : rawSizeStock;
        dbUpdates.sizeStock = ss;
        newStock = Object.values(ss).reduce((s, v) => s + Number(v || 0), 0);
        dbUpdates.stock = newStock;
      } catch(_) {}
    } else if (stock !== undefined && stock >= 0) {
      newStock = Number(stock);
      dbUpdates.stock = newStock;
    } else {
      return res.status(400).json({ success: false, message: 'Valid stock or sizeStock required' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: dbUpdates },
      { new: true }
    );

    const diff = newStock - oldStock;
    if (diff !== 0) {
      const type = diff > 0 ? 'in' : 'out';
      const finalReason = reason || (diff > 0 ? 'Manual restock' : 'Manual reduction');
      await logStockMovement(product._id, product.productName, diff, newStock, type, finalReason, updatedBy || 'Admin');
    }

    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

// ── DELETE /api/products/:id (admin only) ──────────────────
router.delete('/:id', roleGuard(['admin', 'editor']), async (req, res, next) => {
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
