import mongoose from 'mongoose';

const billSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, trim: true, lowercase: true },
    customerPhone: { type: String, default: '', trim: true },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },
    txnId: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['online', 'cash', 'upi', 'card'],
      default: 'cash',
    },
    status: {
      type: String,
      enum: ['paid', 'pending', 'authorized', 'cancelled'],
      default: 'paid',
    },
    items: { type: Array, default: [] },
    receivedBy: { type: String, default: '' },
    notes: { type: String, default: '' },
    cashAuthorized: { type: Boolean, default: false },
    cashAuthorizedBy: { type: String, default: '' },
    cashAuthorizedAt: { type: Date, default: null },
    receiptUrl: { type: String, default: '' },
    receiptPublicId: { type: String, default: '' },
    txnType: { type: String, enum: ['receive', 'give'], default: 'receive' },
    txnDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.Bill || mongoose.model('Bill', billSchema);
