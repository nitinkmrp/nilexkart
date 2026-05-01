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

// Route: POST /api/payment/verify
// Desc:  Verify Razorpay payment signature and save order
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, items, amount } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET;
    
    // Create the expected signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const expectedSignature = hmac.digest('hex');

    if (expectedSignature === razorpay_signature) {
      // Save order to db
      const newOrder = new Order({
        email,
        items,
        totalAmount: amount,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        status: 'Paid'
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
// Desc:  Get order history by email
router.get('/orders/:email', async (req, res) => {
  try {
    const orders = await Order.find({ email: req.params.email }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

export default router;
