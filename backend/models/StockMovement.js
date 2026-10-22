import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    productName: {
      type: String,
      required: true,
    },
    changeQty: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['in', 'out', 'adjustment'],
      required: true,
    },
    reason: {
      type: String,
      default: 'Manual adjustment',
    },
    updatedBy: {
      type: String,
      default: 'Admin',
    },
  },
  { timestamps: true }
);

export default mongoose.models.StockMovement ||
  mongoose.model('StockMovement', stockMovementSchema);
