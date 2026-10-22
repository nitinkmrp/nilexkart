import mongoose from 'mongoose';

const productVariantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    size: {
      type: String,
      required: true,
      trim: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      unique: true,
    },
    price: {
      type: Number,
      min: 0,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index on productId + size to guarantee uniqueness per product
productVariantSchema.index({ productId: 1, size: 1 }, { unique: true });

export default mongoose.models.ProductVariant ||
  mongoose.model('ProductVariant', productVariantSchema);
