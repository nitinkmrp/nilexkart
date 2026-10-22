import mongoose from 'mongoose';

const waitlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    productImage: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['waiting', 'notified', 'Out of Stock', 'Back in Stock'],
      default: 'waiting',
    },
  },
  { timestamps: true }
);

// Prevent duplicate entries for same user + product
waitlistSchema.index({ userEmail: 1, productId: 1 }, { unique: true });

export default mongoose.models.Waitlist || mongoose.model('Waitlist', waitlistSchema);
