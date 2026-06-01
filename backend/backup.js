// backend/backup.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBackup() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('\n❌ Error: MONGO_URI environment variable is missing.');
    console.error('   Please verify that backend/.env exists and is populated.\n');
    process.exit(1);
  }

  const safeUri = uri.replace(/:([^@/]+)@/, ':****@');
  console.log('\n📦 Starting Database Backup...');
  console.log(`🔗 Connecting to: ${safeUri}`);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log('✅ Connected to MongoDB.');

    const db = mongoose.connection.db;
    const collections = await db.collections();
    const backupData = {};

    console.log('⚡ Fetching collections data...');
    for (const col of collections) {
      const name = col.collectionName;
      if (name.startsWith('system.')) continue;
      const docs = await col.find({}).toArray();
      backupData[name] = docs;
      console.log(`   ➜ [${name}]: ${docs.length} documents fetched.`);
    }

    const backupPayload = {
      success: true,
      timestamp: new Date().toISOString(),
      dbName: mongoose.connection.name,
      collections: backupData
    };

    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_nilexcart_${timestamp}.json`;
    const filePath = path.join(backupsDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), 'utf-8');

    console.log(`\n🎉 Backup completed successfully!`);
    console.log(`💾 Saved to: ${filePath}`);
    console.log(`📂 Total collections backed up: ${Object.keys(backupData).length}\n`);

  } catch (error) {
    console.error('\n❌ Backup failed with error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.\n');
  }
}

runBackup();
