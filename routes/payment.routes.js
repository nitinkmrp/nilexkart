import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';
import roleGuard from '../middleware/roleGuard.js';

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
  isManualDelivery: { type: Boolean, default: false },
  deliveryTimeline: { type: Array, default: [] }
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
  // If the admin manually updated the delivery status, use the saved timeline
  if (order.isManualDelivery && order.deliveryTimeline && order.deliveryTimeline.length > 0) {
    const enrichedTimeline = order.deliveryTimeline.map((step, index) => {
      const isCurrent = index === order.deliveryTimeline.length - 1;
      return {
        ...step,
        isCompleted: true,
        isCurrent
      };
    });

    return {
      deliveryStatus: order.deliveryStatus || 'Confirmed',
      timeline: enrichedTimeline,
      carrier: order.carrier || 'Delhivery Express',
      trackingId: order.trackingId || 'NIX-GEN-00000-IN',
      shippingAddress: order.shippingAddress || '123 Nilex Boulevard, New Delhi'
    };
  }

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

      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });

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
        isManualDelivery: false,
        deliveryTimeline: [
          {
            status: 'Confirmed',
            label: 'Order Confirmed',
            desc: 'Your order was successfully verified and placed.',
            time: nowTime
          }
        ]
      });
      await newOrder.save();

      // ── Deduct purchased quantities from product stock ───────────────────
      try {
        const ProductModel = mongoose.models.Product || mongoose.model('Product');
        const StockMovementModel = mongoose.models.StockMovement || mongoose.model('StockMovement');

        for (const item of items) {
          const pId = item._id || item.id;
          if (!pId) continue;

          const product = await ProductModel.findById(pId);
          if (!product) continue;

          const qtyPurchased = Number(item.qty || 1);
          const oldStock = product.stock || 0;

          const updates = {};
          let newStock = oldStock - qtyPurchased;
          if (newStock < 0) newStock = 0; // Prevent dropping below 0

          // If product is size-aware and sizeStock exists
          if (item.selectedSize && product.sizeStock) {
            const currentSizeStock = product.sizeStock.get(item.selectedSize) || 0;
            let newSizeStock = currentSizeStock - qtyPurchased;
            if (newSizeStock < 0) newSizeStock = 0;

            product.sizeStock.set(item.selectedSize, newSizeStock);
            updates.sizeStock = product.sizeStock;

            // Re-sum total stock
            let total = 0;
            for (const [size, sQty] of product.sizeStock.entries()) {
              total += Number(sQty || 0);
            }
            newStock = total;
          }

          updates.stock = newStock;

          // Save product updates
          await ProductModel.findByIdAndUpdate(pId, { $set: updates });

          // Log stock movement for AI analytics & ledger logs
          if (StockMovementModel) {
            await StockMovementModel.create({
              productId: pId,
              productName: product.productName,
              changeQty: -qtyPurchased,
              newStock: newStock,
              type: 'out',
              reason: `Customer purchase (Order #${razorpay_order_id})`,
              updatedBy: email || 'System'
            });
          }
        }
      } catch (stockErr) {
        console.error("Failed to automatically deduct product stock:", stockErr);
      }

      res.status(200).json({ success: true, message: "Payment verified successfully", order: newOrder });
    } else {
      res.status(400).json({ success: false, message: "Invalid payment signature" });
    }
  } catch (error) {
    console.error("Payment verification failed:", error);
    res.status(500).json({ message: "Payment verification failed" });
  }
});

// Route: POST /api/payment/checkout-cod
// Desc:  Create a Cash on Delivery order (useful for mobile app)
router.post('/checkout-cod', async (req, res) => {
  try {
    const { email, items, amount, address } = req.body;

    const carriers = ['BlueDart', 'Delhivery Express', 'DHL Express', 'FedEx'];
    const chosenCarrier = carriers[Math.floor(Math.random() * carriers.length)];
    const randomTrackingId = `NIX-COD-${chosenCarrier.substring(0,3).toUpperCase()}-${Math.floor(10000000 + Math.random() * 90000000)}-IN`;

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });

    // Save order to db
    const newOrder = new Order({
      email,
      items,
      totalAmount: amount,
      razorpayOrderId: 'COD_' + Date.now(),
      razorpayPaymentId: 'COD',
      status: 'Pending Cash',
      trackingId: randomTrackingId,
      carrier: chosenCarrier,
      shippingAddress: address || '123 Nilex Corporate Boulevard, Suite 50',
      deliveryStatus: 'Confirmed',
      isManualDelivery: false,
      deliveryTimeline: [
        {
          status: 'Confirmed',
          label: 'Order Confirmed',
          desc: 'Your COD order was successfully placed.',
          time: nowTime
        }
      ]
    });
    await newOrder.save();

    // ── Deduct purchased quantities from product stock ───────────────────
    try {
      const ProductModel = mongoose.models.Product || mongoose.model('Product');
      const StockMovementModel = mongoose.models.StockMovement || mongoose.model('StockMovement');

      for (const item of items) {
        const pId = item._id || item.id;
        if (!pId) continue;

        const product = await ProductModel.findById(pId);
        if (!product) continue;

        const qtyPurchased = Number(item.qty || 1);
        const oldStock = product.stock || 0;

        const updates = {};
        let newStock = oldStock - qtyPurchased;
        if (newStock < 0) newStock = 0;

        if (item.selectedSize && product.sizeStock) {
          const currentSizeStock = product.sizeStock.get(item.selectedSize) || 0;
          let newSizeStock = currentSizeStock - qtyPurchased;
          if (newSizeStock < 0) newSizeStock = 0;

          product.sizeStock.set(item.selectedSize, newSizeStock);
          updates.sizeStock = product.sizeStock;

          let total = 0;
          for (const [size, sQty] of product.sizeStock.entries()) {
            total += Number(sQty || 0);
          }
          newStock = total;
        }

        updates.stock = newStock;
        await ProductModel.findByIdAndUpdate(pId, { $set: updates });

        if (StockMovementModel) {
          await StockMovementModel.create({
            productId: pId,
            productName: product.productName,
            changeQty: -qtyPurchased,
            newStock: newStock,
            type: 'out',
            reason: `Customer COD purchase (Order #${newOrder.razorpayOrderId})`,
            updatedBy: email || 'System'
          });
        }
      }
    } catch (stockErr) {
      console.error("Failed to automatically deduct product stock for COD:", stockErr);
    }

    res.status(200).json({ success: true, message: "COD Order placed successfully", order: newOrder });
  } catch (error) {
    console.error("COD checkout failed:", error);
    res.status(500).json({ message: "COD checkout failed" });
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

// Route: GET /api/payment/orders
// Desc:  Get all orders (admin role protected)
router.get('/orders', roleGuard(['admin', 'editor', 'support']), async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    
    // Enrich orders with timeline information for administration overview
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
    console.error("Error fetching all orders for admin:", error);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

// Route: PATCH /api/payment/orders/:id/delivery
// Desc:  Update delivery status and shipping details (admin role protected)
router.patch('/orders/:id/delivery', roleGuard(['admin', 'editor', 'support']), async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryStatus, carrier, trackingId, shippingAddress } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Default descriptions for delivery milestones
    const descriptions = {
      'Confirmed': 'Your order was successfully verified and placed.',
      'Processing': 'Package has been sealed and carrier label attached.',
      'Shipped': 'Handed over to carrier partner at our warehouse facility.',
      'In Transit': 'Arrived at the regional sorting facility and routed.',
      'Out for Delivery': 'Delivery executive is on the way to your shipping address.',
      'Delivered': 'Delivered successfully. Package was signed by customer.'
    };

    const labels = {
      'Confirmed': 'Order Confirmed',
      'Processing': 'Packed & Labeled',
      'Shipped': 'Dispatched from Hub',
      'In Transit': 'In Transit (Sorting)',
      'Out for Delivery': 'Out for Delivery',
      'Delivered': 'Delivered & Signed'
    };

    // If address, carrier, trackingId are provided, update them
    if (carrier !== undefined) order.carrier = carrier;
    if (trackingId !== undefined) order.trackingId = trackingId;
    if (shippingAddress !== undefined) order.shippingAddress = shippingAddress;

    // If deliveryStatus is provided and differs from current status
    if (deliveryStatus !== undefined && deliveryStatus !== order.deliveryStatus) {
      order.deliveryStatus = deliveryStatus;
      order.isManualDelivery = true;

      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
      
      // Construct the new step
      const newStep = {
        status: deliveryStatus,
        label: labels[deliveryStatus] || deliveryStatus,
        desc: descriptions[deliveryStatus] || `Order shipment status updated to ${deliveryStatus}`,
        time: nowTime
      };

      // Append new step to delivery timeline
      if (!order.deliveryTimeline || order.deliveryTimeline.length === 0) {
        order.deliveryTimeline = [
          {
            status: 'Confirmed',
            label: 'Order Confirmed',
            desc: 'Your order was successfully verified and placed.',
            time: new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
          }
        ];
      }

      // Avoid duplicating consecutive states
      const lastStep = order.deliveryTimeline[order.deliveryTimeline.length - 1];
      if (!lastStep || lastStep.status !== deliveryStatus) {
        order.deliveryTimeline.push(newStep);
      }
    }

    await order.save();

    // Re-fetch enriched order details to return
    const enrichedOrder = order.toObject();
    const trackingInfo = getTrackingTimeline(enrichedOrder);
    
    res.status(200).json({
      success: true,
      message: "Order delivery details updated successfully",
      order: {
        ...enrichedOrder,
        tracking: trackingInfo,
        deliveryStatus: trackingInfo.deliveryStatus
      }
    });

  } catch (error) {
    console.error("Failed to update order delivery details:", error);
    res.status(500).json({ success: false, message: "Failed to update order delivery status" });
  }
});

// Route: GET /api/payment/delhivery/pincode/:pincode
// Desc:  Verify pincode serviceability using Delhivery API (proxy to protect API Key)
router.get('/delhivery/pincode/:pincode', async (req, res) => {
  try {
    const { pincode } = req.params;
    const token = process.env.DELHIVERY_API_TOKEN || "Token api-token-key Pass Token as 'Token XXXXXXXXXXXXXXXXXX'";

    console.log(`Checking Delhivery serviceability for pincode: ${pincode}`);

    const response = await fetch(`https://staging-express.delhivery.com/c/api/pin-codes/json/?filter_codes=${pincode}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token.startsWith("Token ") ? token : `Token ${token}`
      }
    });

    const data = await response.json();
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Delhivery pincode serviceability check failed:", error);
    res.status(500).json({ success: false, message: "Delhivery API check failed", error: error.message });
  }
});

export default router;
