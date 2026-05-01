import mongoose from 'mongoose';

const dbConnect = async () => {
  const uri = process.env.MONGO_URI;

  // Guard: fail fast if URI is missing or still a placeholder
  if (!uri || uri.includes('<') || uri.includes('YOUR_')) {
    console.error('\n❌  MONGO_URI is not set or still contains a placeholder.');
    console.error('    Open  backend/.env  and set your connection string.\n');
    console.error('    MongoDB Atlas:');
    console.error('    MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/<dbname>\n');
    console.error('    Local MongoDB:');
    console.error('    MONGO_URI=mongodb://localhost:27017/<dbname>\n');
    process.exit(1);
  }

  const safeUri = uri.replace(/:([^@/]+)@/, ':****@');
  console.log('\n🔗  Connecting to MongoDB...');
  console.log('    URI ➜ ', safeUri, '\n');

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });

    const dbName = mongoose.connection.name;
    const host   = mongoose.connection.host;
    console.log('✅  MongoDB connected');
    console.log('    Database ➜ ', dbName);
    console.log('    Host     ➜ ', host, '\n');
  } catch (error) {
    console.error('\n❌  MongoDB connection failed:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n    💡 Local MongoDB is not running.');
      console.error('       Start it with:  mongod --dbpath /data/db');
    } else if (error.message.includes('Authentication failed') || error.message.includes('bad auth')) {
      console.error('\n    💡 Wrong username or password in MONGO_URI.');
    } else if (error.message.includes('timed out') || error.message.includes('ETIMEDOUT')) {
      console.error('\n    💡 Connection timed out.');
      console.error('       Atlas users: Network Access → add your IP or 0.0.0.0/0');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('\n    💡 Hostname not found — check the cluster URL in MONGO_URI.');
    }

    console.error('');
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
  mongoose.connection.on('reconnected',  () => console.log('♻️  MongoDB reconnected'));
};

export default dbConnect;
