import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dbConnect from './config/db.js';

dotenv.config();

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, trim: true, unique: true, lowercase: true },
    description: { type: String, default: '' },
    icon: { type: String, default: '📦' },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

const cleanCategories = async () => {
    try {
        await dbConnect();
        console.log("Connected to database...");

        const result = await Category.deleteMany({
            name: { $nin: ['Shirt', 'Jeans'] } // Delete anything that isn't Shirt or Jeans
        });

        console.log(`Deleted ${result.deletedCount} unwanted categories.`);
        
        process.exit(0);
    } catch (error) {
        console.error("Error cleaning categories:", error);
        process.exit(1);
    }
};

cleanCategories();
