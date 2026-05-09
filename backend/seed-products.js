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

const productSchema = new mongoose.Schema({
    productName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true }, // Store slug or name here
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, default: 0, min: 0 },
    shortDesc: { type: String, default: '' },
    description: { type: String, default: '' },
    imgUrl: { type: String, default: '' },
    publicId: { type: String, default: '' },
    avgRating: { type: Number, default: 0 },
}, { timestamps: true });

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

const seedDatabase = async () => {
    try {
        await dbConnect();
        console.log("Connected to database...");

        // Remove all existing products
        console.log("Removing all existing products...");
        await Product.deleteMany({});
        console.log("Cleared existing products.");

        // Check categories and add Shirt and Jeans if missing
        const requiredCategories = ['Shirt', 'Jeans'];
        
        for (const catName of requiredCategories) {
            const exists = await Category.findOne({ name: { $regex: new RegExp('^' + catName + '$', 'i') } });
            if (!exists) {
                console.log(`Creating category: ${catName}`);
                await Category.create({
                    name: catName,
                    slug: catName.toLowerCase(),
                    icon: catName === 'Shirt' ? '👕' : '👖'
                });
            }
        }

        const shirtImages = [
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1581655353564-df123a1eb820?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1503341455253-b2e723bb3db8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1596755094514-f87e32f85e2c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1602810318383-e386cc2a3ce3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        ];

        const jeansImages = [
            "https://images.unsplash.com/photo-1542272604-787c3835535d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1604176354204-9268738128ce?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1565084888279-aca607ecce0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1582552938357-32b906df40cb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        ];

        const adjectives = ["Classic", "Modern", "Vintage", "Premium", "Casual", "Stylish", "Comfortable", "Designer", "Slim Fit", "Regular"];
        const shirtNouns = ["T-Shirt", "Polo Shirt", "Button-Down", "Flannel", "V-Neck", "Graphic Tee"];
        const jeansNouns = ["Denim Jeans", "Ripped Jeans", "Bootcut Jeans", "Skinny Jeans", "Straight Leg Jeans", "High-Waisted Jeans"];

        const sampleProducts = [];
        let shirtCount = 0;
        let jeansCount = 0;

        // Add 12 Shirts
        for (let i = 0; i < 12; i++) {
            const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
            const noun = shirtNouns[Math.floor(Math.random() * shirtNouns.length)];
            const img = shirtImages[shirtCount % shirtImages.length];
            shirtCount++;

            sampleProducts.push({
                productName: `${adj} ${noun}`,
                category: 'Shirt',
                price: Math.floor(Math.random() * 50) + 15, // $15 - $64
                discount: Math.floor(Math.random() * 15),
                stock: Math.floor(Math.random() * 100) + 10,
                shortDesc: `A highly requested ${adj.toLowerCase()} ${noun.toLowerCase()} with premium cotton.`,
                description: `This ${adj.toLowerCase()} ${noun.toLowerCase()} is perfect for daily wear. It offers exceptional comfort, high durability, and a great fit. Machine washable and long-lasting material.`,
                avgRating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)), // 3.5 - 5.0
                imgUrl: img
            });
        }

        // Add 12 Jeans
        for (let i = 0; i < 12; i++) {
            const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
            const noun = jeansNouns[Math.floor(Math.random() * jeansNouns.length)];
            const img = jeansImages[jeansCount % jeansImages.length];
            jeansCount++;

            sampleProducts.push({
                productName: `${adj} ${noun}`,
                category: 'Jeans',
                price: Math.floor(Math.random() * 80) + 30, // $30 - $109
                discount: Math.floor(Math.random() * 20),
                stock: Math.floor(Math.random() * 80) + 5,
                shortDesc: `Durable and fashionable ${adj.toLowerCase()} ${noun.toLowerCase()}.`,
                description: `These ${adj.toLowerCase()} ${noun.toLowerCase()} are crafted from premium denim to ensure they last a lifetime while looking exceptionally stylish.`,
                avgRating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)), // 3.5 - 5.0
                imgUrl: img
            });
        }

        console.log(`Inserting ${sampleProducts.length} new products (Shirts and Jeans)...`);
        await Product.insertMany(sampleProducts);
        console.log("Successfully inserted 24 new sample products!");

        process.exit(0);
    } catch (error) {
        console.error("Error seeding database:", error);
        process.exit(1);
    }
};

seedDatabase();
