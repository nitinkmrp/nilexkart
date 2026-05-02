/**
 * migrate-images.js
 * One-time script: uploads every local /uploads/ image to Cloudinary
 * and patches each product's imgUrl + publicId in MongoDB.
 *
 * Run:  node migrate-images.js
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Cloudinary config ─────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Mongoose product schema (mirrors your routes file) ─
const productSchema = new mongoose.Schema(
  {
    productName: String,
    category:    String,
    price:       Number,
    discount:    Number,
    stock:       Number,
    shortDesc:   String,
    description: String,
    imgUrl:      String,
    publicId:    String,
    avgRating:   Number,
  },
  { timestamps: true }
);
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

// ── Main ──────────────────────────────────────────────
async function migrate() {
  console.log('\n🔌  Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅  Connected.\n');

  const products = await Product.find({});
  console.log(`📦  Found ${products.length} products in database.\n`);

  let updated = 0;
  let skipped = 0;
  let failed  = 0;

  for (const product of products) {
    const imgUrl = product.imgUrl || '';

    // ── Already a Cloudinary URL → skip ───────────────
    if (imgUrl.startsWith('https://res.cloudinary.com')) {
      console.log(`⏭️   SKIP  "${product.productName}" — already on Cloudinary`);
      skipped++;
      continue;
    }

    // ── Has a local /uploads/ path → upload ───────────
    if (imgUrl.startsWith('/uploads/')) {
      const filename  = imgUrl.replace('/uploads/', '');
      const localPath = path.join(__dirname, 'uploads', filename);

      if (!fs.existsSync(localPath)) {
        console.log(`⚠️   MISS  "${product.productName}" — file not found: ${localPath}`);
        failed++;
        continue;
      }

      try {
        console.log(`⬆️   UPLOADING  "${product.productName}" (${filename})…`);
        const result = await cloudinary.uploader.upload(localPath, {
          folder: 'ecommerce-products',
          transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
        });

        await Product.findByIdAndUpdate(product._id, {
          imgUrl:   result.secure_url,
          publicId: result.public_id,
        });

        console.log(`✅   DONE  "${product.productName}" → ${result.secure_url}`);
        updated++;
      } catch (err) {
        console.error(`❌   FAIL  "${product.productName}":`, err.message);
        failed++;
      }
      continue;
    }

    // ── Has an external URL (http/https non-cloudinary) → skip ─
    if (imgUrl.startsWith('http')) {
      console.log(`⏭️   SKIP  "${product.productName}" — external URL already set`);
      skipped++;
      continue;
    }

    // ── Empty imgUrl ───────────────────────────────────
    console.log(`⬜  EMPTY  "${product.productName}" — no image, skipping`);
    skipped++;
  }

  console.log('\n─────────────────────────────────────');
  console.log(`✅  Updated : ${updated}`);
  console.log(`⏭️   Skipped : ${skipped}`);
  console.log(`❌  Failed  : ${failed}`);
  console.log('─────────────────────────────────────\n');

  await mongoose.disconnect();
  console.log('🔌  Disconnected from MongoDB. Migration complete!\n');
}

migrate().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
