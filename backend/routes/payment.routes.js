import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';

const router = express.Router();

// ── Order Schema (inline for simplicity) ─────────────
const orderSchema = new mongoose.Schema({
  email: { type: String, required: true },
  items: { type: Array, required: true },
  totalAmount: { type: Number, required: true },
  razorpayOrderId: { type: String, required: true },
  razorpayPaymentId: { type: String, required: true },
  status: { type: String, default: 'Paid' },
  
  // Delivery & Tracking fields
  trackingId: { type: String, default: '' },
  carrier: { type: String, default: '' },
  shippingAddress: { type: String, default: '123 E-Commerce Way, Suite 100' },
  deliveryStatus: { type: String, default: 'Processing' }, // Processing, Shipped, In Transit, Out for Delivery, Delivered
}, { timestamps: true });

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

// Initialize Razorpay instance
// It's safe to define this lazily or handle missing keys gracefully for dev
const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'YOUR_RAZORPAY_KEY_ID') {
    throw new Error("Razorpay keys are not configured in backend/.env");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// Route: POST /api/payment/create-order
// Desc:  Create a Razorpay order before frontend checkout
router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = "INR" } = req.body;

    if (!amount) {
      return res.status(400).json({ message: "Amount is required" });
    }

    const instance = getRazorpayInstance();

    const options = {
      amount: amount * 100, // Razorpay works in subunits (e.g., paise for INR)
      currency,
      receipt: `receipt_${Date.now()}`,
    };

    const order = await instance.orders.create(options);

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ message: error.message || "Failed to create order" });
  }
});

// Helper to dynamically calculate live delivery milestones based on elapsed time since order creation
const getTrackingTimeline = (order) => {
  const createdTime = new Date(order.createdAt || Date.now()).getTime();
  const now = Date.now();
  const diffMs = now - createdTime;
  const diffMins = Math.floor(diffMs / 60000);

  // Delivery milestones with real-time minutes offsets
  const milestones = [
    { status: 'Confirmed', label: 'Order Confirmed', min: 0, desc: 'Your order was successfully verified and placed.' },
    { status: 'Processing', label: 'Packed & Labeled', min: 2, desc: 'Package has been sealed and carrier label attached.' },
    { status: 'Shipped', label: 'Dispatched from Hub', min: 5, desc: 'Handed over to carrier partner at our warehouse facility.' },
    { status: 'In Transit', label: 'In Transit (Local Sorting)', min: 15, desc: 'Arrived at the regional sorting facility and routed.' },
    { status: 'Out for Delivery', label: 'Out for Delivery', min: 45, desc: 'Delivery executive is on the way to your shipping address.' },
    { status: 'Delivered', label: 'Delivered & Signed', min: 90, desc: 'Delivered successfully. Package was signed by customer.' }
  ];

  let activeIndex = 0;
  for (let i = 0; i < milestones.length; i++) {
    if (diffMins >= milestones[i].min) {
      activeIndex = i;
    }
  }

  const timeline = milestones.map((m, index) => {
    const isCompleted = index <= activeIndex;
    const isCurrent = index === activeIndex;
    const milestoneTime = new Date(createdTime + m.min * 60000);

    return {
      status: m.status,
      label: m.label,
      desc: m.desc,
      time: isCompleted ? milestoneTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + milestoneTime.toLocaleDateString([], { month: 'short', day: 'numeric' }) : null,
      isCompleted,
      isCurrent
    };
  });

  return {
    deliveryStatus: milestones[activeIndex].status,
    timeline,
    carrier: order.carrier || 'Delhivery Express',
    trackingId: order.trackingId || 'NIX-GEN-00000-IN',
    shippingAddress: order.shippingAddress || '123 Nilex Boulevard, New Delhi'
  };
};

// Route: POST /api/payment/verify
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, items, amount, address } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET;
    
    // Create the expected signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const expectedSignature = hmac.digest('hex');

    if (expectedSignature === razorpay_signature) {
      // Pick a random real-world carrier for delivery
      const carriers = ['BlueDart', 'Delhivery Express', 'DHL Express', 'FedEx'];
      const chosenCarrier = carriers[Math.floor(Math.random() * carriers.length)];
      const randomTrackingId = `NIX-${chosenCarrier.substring(0,3).toUpperCase()}-${Math.floor(10000000 + Math.random() * 90000000)}-IN`;

      // Save order to db
      const newOrder = new Order({
        email,
        items,
        totalAmount: amount,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        status: 'Paid',
        trackingId: randomTrackingId,
        carrier: chosenCarrier,
        shippingAddress: address || '123 Nilex Corporate Boulevard, Suite 50',
        deliveryStatus: 'Confirmed',
      });
      await newOrder.save();

      res.status(200).json({ success: true, message: "Payment verified successfully", order: newOrder });
    } else {
      res.status(400).json({ success: false, message: "Invalid payment signature" });
    }
  } catch (error) {
    console.error("Payment verification failed:", error);
    res.status(500).json({ message: "Payment verification failed" });
  }
});

// Route: GET /api/payment/orders/:email
router.get('/orders/:email', async (req, res) => {
  try {
    const orders = await Order.find({ email: req.params.email }).sort({ createdAt: -1 });
    
    // Enrich orders with live delivery and tracking timeline info
    const enrichedOrders = orders.map(order => {
      const orderObj = order.toObject();
      const trackingInfo = getTrackingTimeline(orderObj);
      return {
        ...orderObj,
        tracking: trackingInfo,
        deliveryStatus: trackingInfo.deliveryStatus
      };
    });

    res.status(200).json({ success: true, orders: enrichedOrders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

export default router;
