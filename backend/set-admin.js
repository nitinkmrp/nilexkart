/**
 * set-admin.js
 * One-time script: sets role='admin' for a given email in MongoDB.
 * Run: node set-admin.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const ADMIN_EMAIL = 'nitin@gmail.com';

const userSchema = new mongoose.Schema({
  name:     String,
  email:    { type: String, lowercase: true },
  password: String,
  role:     { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function run() {
  console.log('\n🔌  Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅  Connected.\n');

  const user = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    { $set: { role: 'admin' } },
    { new: true }
  );

  if (!user) {
    console.error(`❌  No user found with email: ${ADMIN_EMAIL}`);
  } else {
    console.log(`✅  "${user.name}" (${user.email}) is now role = ${user.role}`);
  }

  await mongoose.disconnect();
  console.log('🔌  Done.\n');
}

run().catch(err => { console.error(err); process.exit(1); });
