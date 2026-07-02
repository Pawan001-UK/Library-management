import mongoose from 'mongoose'

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date },
    status: { type: String, enum: ['issued', 'returned', 'overdue'], default: 'issued' },
    renewalCount: { type: Number, default: 0 },
    fine: { type: Number, default: 0 },
  },
  { timestamps: true }
)

export const Transaction = mongoose.model('Transaction', transactionSchema)


