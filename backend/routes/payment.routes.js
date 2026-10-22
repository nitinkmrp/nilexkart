import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';
import roleGuard from '../middleware/roleGuard.js';
import { generateAICopy, cleanCopyText } from './ai.routes.js';
import {
  Order,
  OrderItem,
  Payment,
  Shipment,
  TrackingEvent,
  Address,
  Product,
  ProductVariant,
  StockMovement,
  User,
  DeliverySettings,
} from '../models/index.js';
import {
  sendOrderNotificationEmail,
  sendOrderConfirmationCustomerEmail,
} from '../utils/emailService.js';

const router = express.Router();

// ── Helper to dispatch order notification emails to admin delivery recipients and customer ──
const dispatchOrderNotifications = async (order, orderType = 'Online Order') => {
  try {
    const settings = await DeliverySettings.findOne({ key: 'global_delivery_settings' });
    const emailAlertsEnabled = settings ? settings.emailAlertsEnabled !== false : true;
    const recipients = (settings?.notificationEmails || []).filter(
      (e) => e && typeof e === 'string' && e.includes('@')
    );

    if (emailAlertsEnabled && recipients.length > 0) {
      console.log(
        `[Order Dispatch] Sending order alert email to ${recipients.join(', ')} for Order #${order.razorpayOrderId}`
      );
      await sendOrderNotificationEmail({
        order,
        recipients,
        orderType,
      });
    } else {
      console.log(
        '[Order Dispatch] No delivery alert email recipients configured or email alerts disabled.'
      );
    }

    if (settings?.notifyCustomer !== false && order.email) {
      await sendOrderConfirmationCustomerEmail({
        order,
        orderType,
      });
    }
  } catch (err) {
    console.error('[Order Notification Dispatch Error]:', err.message);
  }
};

// ── Helper to dual-write normalized entities (Payment, Shipment, OrderItem, TrackingEvent, Address) ──
const dualWriteNormalizedOrder = async (order, {
  method = 'razorpay',
  razorpayOrderId = '',
  razorpayPaymentId = '',
  paymentStatus = 'captured',
  carrier = 'Delhivery Express',
  trackingId = '',
  shippingAddress = '',
}) => {
  try {
    // 1. Normalized Payment record
    await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $setOnInsert: {
          orderId: order._id,
          method,
          razorpayOrderId: razorpayOrderId || order.razorpayOrderId,
          razorpayPaymentId: razorpayPaymentId || order.razorpayPaymentId,
          amount: order.totalAmount,
          currency: 'INR',
          status: paymentStatus,
        },
      },
      { upsert: true }
    );

    // 2. Normalized Shipment record
    const shipment = await Shipment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          carrier: carrier || order.carrier || 'Delhivery Express',
          trackingId: trackingId || order.trackingId,
          deliveryStatus: order.deliveryStatus || 'Confirmed',
          shippingAddress: shippingAddress || order.shippingAddress,
        },
        $setOnInsert: { orderId: order._id },
      },
      { upsert: true, new: true }
    );

    // 3. Initial Tracking Event
    const existingEvents = await TrackingEvent.countDocuments({ orderId: order._id });
    if (existingEvents === 0 && shipment) {
      await TrackingEvent.create({
        shipmentId: shipment._id,
        orderId: order._id,
        milestone: 'Order Confirmed',
        note: 'Order confirmed and registered for dispatch.',
        occurredAt: order.createdAt || new Date(),
      });
    }

    // 4. Normalized OrderItems
    const existingItems = await OrderItem.countDocuments({ orderId: order._id });
    if (existingItems === 0 && Array.isArray(order.items)) {
      for (const item of order.items) {
        const pId = item._id || item.id;
        let variantId = null;
        if (item.selectedSize && pId && mongoose.isValidObjectId(pId)) {
          const v = await ProductVariant.findOne({ productId: pId, size: item.selectedSize });
          if (v) variantId = v._id;
        }

        await OrderItem.create({
          orderId: order._id,
          productId: pId && mongoose.isValidObjectId(pId) ? pId : null,
          variantId,
          productName: item.productName || item.name || 'Product',
          unitPrice: Number(item.price || 0),
          qty: Number(item.qty || 1),
          selectedSize: item.selectedSize || '',
          imgUrl: item.imgUrl || '',
        });
      }
    }

    // 5. Link/Extract Address if valid
    if (order.email && order.shippingAddress && order.shippingAddress.length > 10) {
      const existingAddr = await Address.findOne({
        userEmail: order.email.toLowerCase().trim(),
        line1: order.shippingAddress.slice(0, 40),
      });

      if (!existingAddr) {
        const user = await User.findOne({ email: order.email.toLowerCase().trim() });
        const parts = order.shippingAddress.split(',').map((p) => p.trim());
        const city = parts.length > 2 ? parts[parts.length - 2] : 'City';
        const pincodeMatch = order.shippingAddress.match(/\b\d{6}\b/);

        await Address.create({
          userId: user ? user._id : null,
          userEmail: order.email.toLowerCase().trim(),
          label: 'home',
          fullName: user ? user.name : order.email.split('@')[0],
          phone: '9999999999',
          line1: parts[0] || order.shippingAddress,
          line2: parts.slice(1, 3).join(', '),
          city: city || 'City',
          state: 'State',
          pincode: pincodeMatch ? pincodeMatch[0] : '110001',
          country: 'IN',
          isDefault: true,
        });
      }
    }
  } catch (err) {
    console.error('[Dual-Write Error]:', err.message);
  }
};

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
          // Also update ProductVariant stock if size is chosen
          if (item.selectedSize && pId && mongoose.isValidObjectId(pId)) {
            await ProductVariant.findOneAndUpdate(
              { productId: pId, size: item.selectedSize },
              { $inc: { stock: -qtyPurchased } }
            );
          }
        }
      } catch (stockErr) {
        console.error("Failed to automatically deduct product stock:", stockErr);
      }

      // ── Dual-write normalized entities (Payment, Shipment, TrackingEvent, OrderItems) ──
      dualWriteNormalizedOrder(newOrder, {
        method: 'razorpay',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        paymentStatus: 'captured',
        carrier: chosenCarrier,
        trackingId: randomTrackingId,
        shippingAddress: address,
      }).catch((err) => console.error('Async dual-write failed:', err));

      // ── Send Order Notification Email to configured Admin Delivery Recipients ──
      dispatchOrderNotifications(newOrder, 'Online Payment (Razorpay)').catch((err) => {
        console.error('Failed to dispatch online order notification emails:', err);
      });

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
          // Also update ProductVariant stock if size is chosen
          if (item.selectedSize && pId && mongoose.isValidObjectId(pId)) {
            await ProductVariant.findOneAndUpdate(
              { productId: pId, size: item.selectedSize },
              { $inc: { stock: -qtyPurchased } }
            );
          }
        }
      }
    } catch (stockErr) {
      console.error("Failed to automatically deduct product stock for COD:", stockErr);
    }

    // ── Dual-write normalized entities (Payment, Shipment, TrackingEvent, OrderItems) ──
    dualWriteNormalizedOrder(newOrder, {
      method: 'cod',
      razorpayOrderId: newOrder.razorpayOrderId,
      razorpayPaymentId: 'COD',
      paymentStatus: 'Pending Cash',
      carrier: chosenCarrier,
      trackingId: randomTrackingId,
      shippingAddress: address,
    }).catch((err) => console.error('Async dual-write failed:', err));

    // ── Send Order Notification Email to configured Admin Delivery Recipients ──
    dispatchOrderNotifications(newOrder, 'Cash on Delivery (COD)').catch((err) => {
      console.error('Failed to dispatch COD order notification emails:', err);
    });

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

    // ── Also sync normalized Shipment and TrackingEvent ──
    try {
      const shipment = await Shipment.findOneAndUpdate(
        { orderId: order._id },
        {
          $set: {
            carrier: order.carrier,
            trackingId: order.trackingId,
            deliveryStatus: order.deliveryStatus,
            shippingAddress: order.shippingAddress,
          },
        },
        { upsert: true, new: true }
      );

      if (deliveryStatus !== undefined) {
        await TrackingEvent.create({
          shipmentId: shipment._id,
          orderId: order._id,
          milestone: labels[deliveryStatus] || deliveryStatus,
          note: descriptions[deliveryStatus] || `Order shipment status updated to ${deliveryStatus}`,
          occurredAt: new Date(),
        });
      }
    } catch (shipErr) {
      console.error('Failed to sync shipment tracking event:', shipErr.message);
    }

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

// ════════════════════════════════════════════════════════════════
// AI DELIVERY INTELLIGENCE & DISPATCH COPILOT ENDPOINTS
// ════════════════════════════════════════════════════════════════

// POST /api/payment/ai-delivery-analyze
// Analyze shipping address, assess RTO risk, recommend optimal courier, and generate WhatsApp notification
router.post('/ai-delivery-analyze', roleGuard(['admin', 'editor']), async (req, res) => {
  const {
    shippingAddress = '',
    pincode = '',
    carrier = '',
    trackingId = '',
    customerName = 'Customer',
    customerPhone = '',
    orderId = '',
    totalAmount = 0,
    items = []
  } = req.body;

  if (!shippingAddress.trim()) {
    return res.status(400).json({ success: false, message: 'Shipping address is required' });
  }

  const prompt = `You are NilexCart's AI Delivery & Logistics Engine.
Analyze the following Indian e-commerce order and address for dispatch:

ORDER DATA:
- Customer Name: ${customerName}
- Shipping Address: "${shippingAddress}"
- Pincode: ${pincode || 'Extracted from address if available'}
- Current Carrier: ${carrier || 'Unassigned'}
- Tracking ID / AWB: ${trackingId || 'Pending'}
- Order ID: ${orderId}
- Total Order Value: ₹${totalAmount}
- Total Items: ${Array.isArray(items) ? items.length : 1}

TASKS:
1. Standardize and clean the address (fix formatting, proper casing, highlight missing landmarks or street info).
2. Calculate RTO (Return-to-Origin) Risk Score (0-100%) and rate it ("Low", "Moderate", "High Risk") with concise reasons.
3. Recommend the optimal Indian courier partner (BlueDart, Delhivery Express, DHL Express, or FedEx) considering cost, speed, and order value with estimated transit days and cost in INR.
4. Generate a polite, branded customer WhatsApp dispatch notification message including the tracking link (https://nilex.in/track/${trackingId || 'AWB'}).

Return strictly valid JSON matching this schema:
{
  "cleanedAddress": "Formatted, standardized delivery address",
  "pincode": "Extracted 6-digit Indian pincode",
  "rtoRiskScore": 15,
  "rtoRiskLevel": "Low",
  "rtoRiskReason": "Concise 1-sentence risk explanation",
  "recommendedCarrier": "Delhivery Express",
  "estimatedTransitDays": "2-3 days",
  "estimatedShippingCost": 65,
  "carrierReason": "Lowest shipping cost and high SLA reliability for this pincode.",
  "whatsAppMessage": "Formatted WhatsApp text with emojis ready to send to customer"
}`;

  const deliverySchema = {
    type: 'OBJECT',
    properties: {
      cleanedAddress: { type: 'STRING' },
      pincode: { type: 'STRING' },
      rtoRiskScore: { type: 'NUMBER' },
      rtoRiskLevel: { type: 'STRING' },
      rtoRiskReason: { type: 'STRING' },
      recommendedCarrier: { type: 'STRING' },
      estimatedTransitDays: { type: 'STRING' },
      estimatedShippingCost: { type: 'NUMBER' },
      carrierReason: { type: 'STRING' },
      whatsAppMessage: { type: 'STRING' }
    },
    required: [
      'cleanedAddress',
      'rtoRiskScore',
      'rtoRiskLevel',
      'recommendedCarrier',
      'whatsAppMessage'
    ]
  };

  try {
    const rawResponse = await generateAICopy(
      prompt,
      true,
      deliverySchema,
      'You are an AI logistics dispatch optimizer. Output strictly valid JSON only.'
    );

    let parsed = {};
    try {
      const clean = rawResponse.replace(/```json|```/gi, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        cleanedAddress: shippingAddress,
        rtoRiskScore: 20,
        rtoRiskLevel: 'Low',
        rtoRiskReason: 'Address format accepted.',
        recommendedCarrier: carrier || 'Delhivery Express',
        estimatedTransitDays: '3-4 days',
        estimatedShippingCost: 65,
        carrierReason: 'Standard fast delivery.',
        whatsAppMessage: `Hi ${customerName}! 📦 Your NilexCart order #${orderId} has been dispatched via ${carrier || 'Delhivery Express'}. Tracking AWB: ${trackingId || 'In Transit'}. Track live: https://nilex.in/track/${trackingId || ''}`
      };
    }

    return res.json({
      success: true,
      data: {
        cleanedAddress: parsed.cleanedAddress || shippingAddress,
        pincode: parsed.pincode || pincode,
        rtoRiskScore: parsed.rtoRiskScore ?? 15,
        rtoRiskLevel: parsed.rtoRiskLevel || 'Low',
        rtoRiskReason: parsed.rtoRiskReason || 'Address has valid structure.',
        recommendedCarrier: parsed.recommendedCarrier || 'Delhivery Express',
        estimatedTransitDays: parsed.estimatedTransitDays || '2-4 days',
        estimatedShippingCost: parsed.estimatedShippingCost || 60,
        carrierReason: parsed.carrierReason || 'Optimal courier for speed and price.',
        whatsAppMessage: parsed.whatsAppMessage || `Hi ${customerName}! Your order #${orderId} is on its way with ${carrier || 'Delhivery Express'}!`
      }
    });

  } catch (err) {
    console.error('AI Delivery analysis failed:', err);
    if (err.message === 'MISSING_API_KEY') {
      return res.status(503).json({
        success: false,
        message: 'Gemini API key is missing. Add GEMINI_API_KEY to your backend .env.'
      });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/payment/ai-delivery-ask
// Natural language and voice query assistant for warehouse & dispatch operations
router.post('/ai-delivery-ask', roleGuard(['admin', 'editor']), async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) {
    return res.status(400).json({ success: false, message: 'Query is required' });
  }

  try {
    const orders = await Order.find({}).lean();
    
    const totalOrders = orders.length;
    const statusCounts = {};
    const carrierCounts = {};
    let totalRevenue = 0;
    let pendingCount = 0;
    let inTransitCount = 0;
    let deliveredCount = 0;

    orders.forEach(o => {
      const status = o.deliveryStatus || 'Processing';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      const carr = o.carrier || 'Unassigned';
      carrierCounts[carr] = (carrierCounts[carr] || 0) + 1;
      
      totalRevenue += o.totalAmount || 0;
      if (status === 'Processing' || status === 'Confirmed' || status === 'Packed') pendingCount++;
      if (status === 'Shipped' || status === 'In Transit' || status === 'Out for Delivery') inTransitCount++;
      if (status === 'Delivered') deliveredCount++;
    });

    const context = `LOGISTICS & DISPATCH SUMMARY:
- Total Orders: ${totalOrders}
- Total Order Value: ₹${totalRevenue.toLocaleString('en-IN')}
- Pending Dispatch: ${pendingCount}
- Active In-Transit / Shipped: ${inTransitCount}
- Delivered: ${deliveredCount}
- Status Breakdown: ${JSON.stringify(statusCounts)}
- Courier Breakdown: ${JSON.stringify(carrierCounts)}
- Recent 10 Orders:
${orders.slice(-10).map(o => `[#${String(o._id).slice(-6)}] Customer: ${o.email} | Amount: ₹${o.totalAmount} | Status: ${o.deliveryStatus || 'Processing'} | Carrier: ${o.carrier || 'None'} | AWB: ${o.trackingId || 'None'} | Address: ${o.shippingAddress || 'N/A'}`).join('\n')}`;

    const prompt = `You are NilexCart's AI Delivery Logistics Operations Copilot.
Answer the admin's delivery/order question accurately and concisely based on the data below.

${context}

Admin Question: "${query.trim()}"

Provide a direct, helpful, professional, and voice-friendly response.`;

    const answer = await generateAICopy(prompt, false);
    return res.json({ success: true, answer: cleanCopyText(answer) });

  } catch (err) {
    console.error('AI Delivery ask failed:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// ORDER NOTIFICATION EMAIL SETTINGS (DELIVERY OPERATIONS)
// ════════════════════════════════════════════════════════════════

// GET /api/payment/delivery-notifications
// Get configured notification recipient emails and alert preferences
router.get('/delivery-notifications', roleGuard(['admin', 'editor', 'support']), async (req, res) => {
  try {
    let settings = await DeliverySettings.findOne({ key: 'global_delivery_settings' });
    if (!settings) {
      settings = await DeliverySettings.create({
        key: 'global_delivery_settings',
        notificationEmails: [],
        emailAlertsEnabled: true,
        notifyCustomer: true,
        lastUpdatedBy: 'System',
      });
    }
    res.json({
      success: true,
      settings: {
        notificationEmails: settings.notificationEmails || [],
        emailAlertsEnabled: settings.emailAlertsEnabled !== false,
        notifyCustomer: settings.notifyCustomer !== false,
        lastUpdatedBy: settings.lastUpdatedBy,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (err) {
    console.error('Error fetching delivery notification settings:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch delivery notification settings' });
  }
});

// PUT /api/payment/delivery-notifications
// Update notification recipient emails and toggle preferences
router.put('/delivery-notifications', roleGuard(['admin', 'editor', 'support']), async (req, res) => {
  try {
    const { notificationEmails = [], emailAlertsEnabled = true, notifyCustomer = true } = req.body;

    // Validate and sanitize emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmails = [...new Set(
      (Array.isArray(notificationEmails) ? notificationEmails : [notificationEmails])
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => emailRegex.test(e))
    )];

    const updated = await DeliverySettings.findOneAndUpdate(
      { key: 'global_delivery_settings' },
      {
        $set: {
          notificationEmails: cleanEmails,
          emailAlertsEnabled: Boolean(emailAlertsEnabled),
          notifyCustomer: Boolean(notifyCustomer),
          lastUpdatedBy: req.user?.email || 'Admin',
        },
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: 'Delivery notification emails updated successfully!',
      settings: {
        notificationEmails: updated.notificationEmails,
        emailAlertsEnabled: updated.emailAlertsEnabled,
        notifyCustomer: updated.notifyCustomer,
        lastUpdatedBy: updated.lastUpdatedBy,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err) {
    console.error('Error updating delivery notification settings:', err);
    res.status(500).json({ success: false, message: 'Failed to update delivery notification settings' });
  }
});

// POST /api/payment/delivery-notifications/test-email
// Send a test order alert to configured or specified email address
router.post('/delivery-notifications/test-email', roleGuard(['admin', 'editor', 'support']), async (req, res) => {
  try {
    const { testEmail } = req.body;
    let recipients = [];
    if (testEmail && testEmail.trim()) {
      recipients = [testEmail.trim().toLowerCase()];
    } else {
      const settings = await DeliverySettings.findOne({ key: 'global_delivery_settings' });
      recipients = settings?.notificationEmails || [];
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    recipients = recipients.filter((e) => emailRegex.test(e));

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No recipient email configured. Please enter or add an email address first.',
      });
    }

    const testOrder = {
      _id: new mongoose.Types.ObjectId(),
      razorpayOrderId: 'TEST-ORD-' + Math.floor(100000 + Math.random() * 900000),
      razorpayPaymentId: 'pay_test_' + Math.floor(100000 + Math.random() * 900000),
      email: 'customer.sample@nilex.in',
      totalAmount: 2499,
      carrier: 'Delhivery Express',
      trackingId: 'NIX-DEL-' + Math.floor(10000000 + Math.random() * 90000000) + '-IN',
      shippingAddress: 'Flat 402, Lotus Residency, Indiranagar, Bengaluru, Karnataka 560038',
      deliveryStatus: 'Confirmed',
      status: 'Paid',
      createdAt: new Date(),
      items: [
        { productName: 'Wireless Active Noise-Cancelling Headphones', qty: 1, price: 1999, selectedSize: 'Black' },
        { productName: 'Braided Type-C Fast Charge Cable (1.5m)', qty: 1, price: 500, selectedSize: 'Standard' },
      ],
    };

    const result = await sendOrderNotificationEmail({
      order: testOrder,
      recipients,
      orderType: 'Test Order Simulation',
    });

    res.json({
      success: true,
      message: `Test order notification email successfully sent to: ${recipients.join(', ')}`,
      result,
    });
  } catch (err) {
    console.error('Error sending test delivery notification email:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to send test email' });
  }
});

export default router;
