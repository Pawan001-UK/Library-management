import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    review: { type: String, default: '' },
  },
  { timestamps: true }
)

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    author: { type: String, required: true },
    isbn: { type: String, required: true, unique: true },
    genres: { type: [String], default: [] },
    copies: { type: Number, default: 1 },
    availableCopies: { type: Number, default: 1 },
    rating: { type: Number, default: 0 },
    description: { type: String, default: '' },
    publishYear: { type: Number },
    publisher: { type: String, default: '' },
    pages: { type: Number },
    language: { type: String, default: 'English' },
    location: { type: String, default: '' },
    aiSummary: { type: String, default: '' },
    reviews: { type: [reviewSchema], default: [] },
  },
  { timestamps: true }
)

export const Book = mongoose.model('Book', bookSchema)