import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import {
  Category,
  Product,
  ProductVariant,
  Order,
  OrderItem,
  Payment,
  Shipment,
  TrackingEvent,
  Address,
  User,
} from '../models/index.js';

const runMigration = async () => {
  const uri = process.argv[2] || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI is not set in backend/.env or passed as an argument.');
    console.log('💡 Usage:');
    console.log('   node backend/scripts/migrate_to_optimized_schema.js "<MONGO_URI>"');
    console.log('   or add MONGO_URI to backend/.env');
    process.exit(1);
  }

  console.log('🔗 Connecting to MongoDB for schema migration...');
  await mongoose.connect(uri);
  console.log('✅ Connected to database:', mongoose.connection.name);

  console.log('\n======================================================');
  console.log('   MIGRATING TO OPTIMIZED RELATIONAL ER SCHEMA');
  console.log('======================================================\n');

  // 1. Sync Categories from Products
  const categories = await Category.find();
  const categoryMap = {};
  categories.forEach((c) => {
    categoryMap[c.name.toLowerCase()] = c._id;
  });

  // 2. Sync Product Variants from Products
  console.log('📦 Step 1: Migrating Products → ProductVariants...');
  const products = await Product.find();
  let createdVariantsCount = 0;
  let updatedProductsCount = 0;

  for (const product of products) {
    // Link categoryId if missing
    if (!product.categoryId && product.category) {
      const catId = categoryMap[product.category.toLowerCase()];
      if (catId) {
        product.categoryId = catId;
        await product.save();
        updatedProductsCount++;
      }
    }

    const sizes = Array.isArray(product.sizes) && product.sizes.length > 0 ? product.sizes : ['Standard'];
    const sizeStock = product.sizeStock || new Map();

    for (const size of sizes) {
      let stock = 0;
      if (sizeStock instanceof Map) {
        stock = sizeStock.get(size) || 0;
      } else if (typeof sizeStock === 'object' && sizeStock !== null) {
        stock = sizeStock[size] || 0;
      }
      if (stock === 0 && sizes.length === 1 && product.stock > 0) {
        stock = product.stock;
      }

      const cleanSlug = (product.productName || 'PROD')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 8)
        .toUpperCase();
      const sku = `SKU-${cleanSlug}-${size.replace(/\s+/g, '').toUpperCase()}`;

      const existingVariant = await ProductVariant.findOne({
        productId: product._id,
        size,
      });

      if (!existingVariant) {
        await ProductVariant.create({
          productId: product._id,
          size,
          stock,
          sku,
          price: product.price,
        });
        createdVariantsCount++;
      } else if (existingVariant.stock !== stock) {
        existingVariant.stock = stock;
        await existingVariant.save();
      }
    }
  }
  console.log(`   ➜ Total Products inspected: ${products.length}`);
  console.log(`   ➜ Created ProductVariants: ${createdVariantsCount}`);

  // 3. Sync Orders → OrderItems, Payments, Shipments, TrackingEvents
  console.log('\n💳 Step 2: Migrating Orders → OrderItems, Payments, Shipments & TrackingEvents...');
  const orders = await Order.find();
  let createdOrderItemsCount = 0;
  let createdPaymentsCount = 0;
  let createdShipmentsCount = 0;
  let createdTrackingEventsCount = 0;
  let createdAddressesCount = 0;

  for (const order of orders) {
    // 3a. Normalized Payment
    const existingPayment = await Payment.findOne({ orderId: order._id });
    if (!existingPayment) {
      const isCod = order.razorpayPaymentId === 'COD' || order.status?.includes('Cash');
      await Payment.create({
        orderId: order._id,
        method: isCod ? 'cod' : 'razorpay',
        razorpayOrderId: order.razorpayOrderId || '',
        razorpayPaymentId: order.razorpayPaymentId || '',
        amount: order.totalAmount || 0,
        currency: 'INR',
        status: isCod ? 'Pending Cash' : 'captured',
      });
      createdPaymentsCount++;
    }

    // 3b. Normalized Shipment
    let shipment = await Shipment.findOne({ orderId: order._id });
    if (!shipment) {
      shipment = await Shipment.create({
        orderId: order._id,
        carrier: order.carrier || 'Delhivery Express',
        trackingId: order.trackingId || '',
        deliveryStatus: order.deliveryStatus || 'Confirmed',
        shippingAddress: order.shippingAddress || '',
      });
      createdShipmentsCount++;
    }

    // 3c. TrackingEvents
    const existingEventsCount = await TrackingEvent.countDocuments({ orderId: order._id });
    if (existingEventsCount === 0 && shipment) {
      if (Array.isArray(order.deliveryTimeline) && order.deliveryTimeline.length > 0) {
        for (const step of order.deliveryTimeline) {
          await TrackingEvent.create({
            shipmentId: shipment._id,
            orderId: order._id,
            milestone: step.label || step.status || 'Order Confirmed',
            note: step.desc || 'Checkpoint status updated',
            occurredAt: order.createdAt || new Date(),
          });
          createdTrackingEventsCount++;
        }
      } else {
        await TrackingEvent.create({
          shipmentId: shipment._id,
          orderId: order._id,
          milestone: 'Order Confirmed',
          note: 'Your order was successfully verified and placed.',
          occurredAt: order.createdAt || new Date(),
        });
        createdTrackingEventsCount++;
      }
    }

    // 3d. Order Items
    const existingItemsCount = await OrderItem.countDocuments({ orderId: order._id });
    if (existingItemsCount === 0 && Array.isArray(order.items)) {
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
        createdOrderItemsCount++;
      }
    }

    // 3e. Extract Address if available
    if (order.email && order.shippingAddress && order.shippingAddress.length > 10) {
      const existingAddr = await Address.findOne({
        userEmail: order.email.toLowerCase().trim(),
        line1: order.shippingAddress.slice(0, 40),
      });

      if (!existingAddr) {
        const user = await User.findOne({ email: order.email.toLowerCase().trim() });
        const parts = order.shippingAddress.split(',').map((p) => p.trim());
        const city = parts.length > 2 ? parts[parts.length - 2] : 'Local City';
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
        createdAddressesCount++;
      }
    }
  }

  console.log(`   ➜ Total Orders inspected: ${orders.length}`);
  console.log(`   ➜ Created OrderItems: ${createdOrderItemsCount}`);
  console.log(`   ➜ Created Payments: ${createdPaymentsCount}`);
  console.log(`   ➜ Created Shipments: ${createdShipmentsCount}`);
  console.log(`   ➜ Created TrackingEvents: ${createdTrackingEventsCount}`);
  console.log(`   ➜ Extracted Addresses: ${createdAddressesCount}`);

  console.log('\n======================================================');
  console.log('   🎉 MIGRATION COMPLETED SUCCESSFULLY!');
  console.log('======================================================\n');
  process.exit(0);
};

runMigration().catch((err) => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
