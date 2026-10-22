import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    category: { type: String, required: true, trim: true },
    sizes: { type: [String], default: [] },
    sizeStock: { type: Map, of: Number, default: {} },
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, default: 0, min: 0 },
    shortDesc: { type: String, default: '' },
    description: { type: String, default: '' },
    imgUrl: { type: String, default: '' },
    publicId: { type: String, default: '' },
    avgRating: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual alias 'name' pointing to 'productName'
productSchema.virtual('name').get(function () {
  return this.productName;
});

// Virtual alias 'discountPct' pointing to 'discount'
productSchema.virtual('discountPct').get(function () {
  return this.discount;
});

export default mongoose.models.Product || mongoose.model('Product', productSchema);
