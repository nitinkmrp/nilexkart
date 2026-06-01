// backend/restore.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const restoreBSON = (val, key = '') => {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}(:?\d{2})?)?$/;
    if (isoDateRegex.test(val)) {
      return new Date(val);
    }
    const isHex24 = /^[0-9a-fA-F]{24}$/.test(val);
    const isIdKey = key === '_id' || /id$/i.test(key);
    if (isHex24 && isIdKey) {
      try {
        return new mongoose.Types.ObjectId(val);
      } catch (e) {
        return val;
      }
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(item => restoreBSON(item, key));
  }
  if (typeof val === 'object') {
    const res = {};
    for (const k in val) {
      res[k] = restoreBSON(val[k], k);
    }
    return res;
  }
  return val;
};

async function runRestore() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('\n❌ Error: Please specify the path to the backup file.');
    console.error('   Usage: node restore.js <path_to_backup_file.json>\n');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ Error: Backup file not found at "${filePath}"\n`);
    process.exit(1);
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('\n❌ Error: MONGO_URI environment variable is missing.');
    console.error('   Please verify that backend/.env exists and is populated.\n');
    process.exit(1);
  }

  const safeUri = uri.replace(/:([^@/]+)@/, ':****@');
  console.log('\n📦 Starting Database Restore...');
  console.log(`🔗 Connecting to: ${safeUri}`);

  try {
    const backupContent = fs.readFileSync(filePath, 'utf-8');
    const backupData = JSON.parse(backupContent);

    if (!backupData.collections || typeof backupData.collections !== 'object') {
      throw new Error('Invalid backup file format: missing "collections" object.');
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log('✅ Connected to MongoDB.');

    const db = mongoose.connection.db;

    console.log('⚡ Restoring collections...');
    for (const [colName, docs] of Object.entries(backupData.collections)) {
      if (colName.startsWith('system.')) continue;
      if (!Array.isArray(docs)) continue;

      const col = db.collection(colName);
      
      console.log(`   ➜ [${colName}]: Clearing existing documents...`);
      await col.deleteMany({});

      if (docs.length > 0) {
        console.log(`   ➜ [${colName}]: Importing ${docs.length} documents...`);
        const parsedDocs = docs.map(d => restoreBSON(d));
        await col.insertMany(parsedDocs);
      }
      console.log(`   ✅ [${colName}]: Restored successfully.`);
    }

    console.log(`\n🎉 Restore completed successfully!`);
    console.log(`📂 Total collections restored: ${Object.keys(backupData.collections).length}\n`);

  } catch (error) {
    console.error('\n❌ Restore failed with error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.\n');
  }
}

runRestore();
