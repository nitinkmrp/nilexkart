import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    addressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address',
      default: null,
    },
    shippingSnapshot: {
      type: Object,
      default: null,
    },
    shippingAddress: {
      type: String,
      default: '123 Nilex Corporate Boulevard, Suite 50',
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: 'Paid',
    },
    orderStatus: {
      type: String,
      enum: [
        'Placed',
        'Confirmed',
        'Processing',
        'Shipped',
        'In Transit',
        'Out for Delivery',
        'Delivered',
        'Cancelled',
      ],
      default: 'Confirmed',
    },
    // Delivery & Tracking fields (kept synced with Shipment for 100% backward compat)
    trackingId: { type: String, default: '' },
    carrier: { type: String, default: '' },
    deliveryStatus: { type: String, default: 'Processing' },
    isManualDelivery: { type: Boolean, default: false },
    deliveryTimeline: { type: Array, default: [] },

    // Embedded items array (kept synced with OrderItem for 100% backward compat)
    items: { type: Array, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model('Order', orderSchema);
