import mongoose from 'mongoose';

const shipmentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    carrier: {
      type: String,
      default: 'Delhivery Express',
      trim: true,
    },
    trackingId: {
      type: String,
      default: '',
      trim: true,
    },
    deliveryStatus: {
      type: String,
      enum: [
        'Pending',
        'Confirmed',
        'Processing',
        'Shipped',
        'In Transit',
        'Out for Delivery',
        'Delivered',
        'Cancelled',
        'RTO',
      ],
      default: 'Confirmed',
    },
    shippingAddress: {
      type: String,
      default: '',
    },
    shippingSnapshot: {
      type: Object,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Shipment || mongoose.model('Shipment', shipmentSchema);
