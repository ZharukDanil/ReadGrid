import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  genre: { type: String, required: true },
  year: { type: Number, required: true },
  description: { type: String, required: true },
  coverUrl: { type: String, required: true },
  fileUrl: { type: String },
  filePublicId: { type: String },
  avgRating: { type: Number, default: 0 },
  ratingsCount: { type: Number, default: 0 },
  isPremium: { type: Boolean, default: false },
}, { timestamps: true });

bookSchema.index({ title: 1, author: 1 }, { unique: true });

export default mongoose.models.Book || mongoose.model('Book', bookSchema);