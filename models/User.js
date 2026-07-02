import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'librarian', 'admin'], default: 'user' },
    membershipId: { type: String, required: true, unique: true },
    booksIssued: { type: Number, default: 0 },
    maxBooksAllowed: { type: Number, default: 3 },
    fineAmount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    // MFA fields
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, default: null },
    backupCodes: { type: [String], default: [] },
  },
  { timestamps: true }
)

export const User = mongoose.model('User', userSchema)