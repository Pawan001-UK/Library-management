// Backend with MongoDB persistence
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { connectDb } from './db.js'
import { User } from './models/User.js'
import { Book } from './models/Book.js'
import { Transaction } from './models/Transaction.js'
import { Notification } from './models/Notification.js'
import {
  getPersonalizedRecommendations,
  getSimilarBooks,
  getCollaborativeRecommendations,
  getTrendingBooks,
  getHybridRecommendations,
  getGenreRecommendations,
  getNewBookSuggestionsByInterest
} from './services/recommendationEngine.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

// Connect DB
await connectDb()

// Helpers
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No token provided' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

const paginate = async (query, { page = 1, limit = 12 } = {}) => {
  const skip = (page - 1) * limit
  const queryObj = query.getQuery ? query.getQuery() : query
  const model = query.model || Book
  const [items, total] = await Promise.all([
    query.skip(skip).limit(limit).exec(),
    model.countDocuments(queryObj),
  ])
  const pages = Math.max(1, Math.ceil(total / limit))
  return { books: items, pagination: { page, pages, total } }
}

const tokenizePrompt = (text = '') =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

const scoreBookForPrompt = (book, terms) => {
  if (!terms.length) return 0
  const title = String(book.title || '').toLowerCase()
  const author = String(book.author || '').toLowerCase()
  const genres = (book.genres || []).map(g => String(g).toLowerCase())
  const description = String(book.description || '').toLowerCase()

  let score = 0
  for (const term of terms) {
    if (title.includes(term)) score += 4
    if (author.includes(term)) score += 3
    if (genres.some(g => g.includes(term))) score += 5
    if (description.includes(term)) score += 2
  }
  score += Number(book.rating || 0) * 0.5
  if ((book.availableCopies || 0) > 0) score += 1.5
  return score
}

// Routes base
const router = express.Router()

// Auth
router.post('/auth/login', async (req, res) => {
  const { email, password, mfaToken } = req.body
  const user = await User.findOne({ email })
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  // If MFA is enabled, require MFA token
  if (user.mfaEnabled) {
    if (!mfaToken) {
      return res.status(200).json({
        requiresMFA: true,
        message: 'MFA code required'
      })
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: mfaToken,
      window: 2
    })

    // If TOTP fails, check backup codes
    if (!verified) {
      const backupCodeIndex = user.backupCodes.indexOf(mfaToken)
      if (backupCodeIndex === -1) {
        return res.status(401).json({ error: 'Invalid MFA code' })
      }
      // Remove used backup code
      user.backupCodes.splice(backupCodeIndex, 1)
      await user.save()
    }
  }

  const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: '7d' })
  const { passwordHash, mfaSecret, ...safe } = user.toObject()
  return res.json({ token, user: safe })
})

router.post('/auth/register', async (req, res) => {
  const { name, email, password, role = 'user', phone = '', address = '' } = req.body
  const exists = await User.findOne({ email })
  if (exists) return res.status(400).json({ error: 'Email already registered' })
  const count = await User.countDocuments()
  const membershipId = `${role === 'admin' ? 'ADM' : role === 'librarian' ? 'LIB' : 'USR'}-${String(count + 1).padStart(4, '0')}`
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.create({ name, email, role, passwordHash, membershipId, phone, address })
  const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: '7d' })
  const { passwordHash: _ph, mfaSecret, ...safe } = user.toObject()
  return res.status(201).json({ token, user: safe })
})

// MFA Routes
router.post('/auth/mfa/setup', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Library Management (${user.email})`,
      issuer: 'Library Management System'
    })

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url)

    // Store secret temporarily (not enabled yet)
    user.mfaSecret = secret.base32
    await user.save()

    return res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32
    })
  } catch (error) {
    console.error('MFA setup error:', error)
    return res.status(500).json({ error: 'Failed to setup MFA' })
  }
})

router.post('/auth/mfa/verify-setup', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body
    const user = await User.findById(req.user.id)
    if (!user || !user.mfaSecret) {
      return res.status(400).json({ error: 'MFA not initialized' })
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: token,
      window: 2
    })

    if (!verified) {
      return res.status(400).json({ error: 'Invalid token' })
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    )

    // Enable MFA
    user.mfaEnabled = true
    user.backupCodes = backupCodes
    await user.save()

    const { passwordHash, mfaSecret, ...safe } = user.toObject()
    return res.json({
      success: true,
      backupCodes,
      user: safe,
      message: 'MFA enabled successfully'
    })
  } catch (error) {
    console.error('MFA verify-setup error:', error)
    return res.status(500).json({ error: 'Failed to verify MFA setup' })
  }
})

router.post('/auth/mfa/disable', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Verify password before disabling
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid password' })

    user.mfaEnabled = false
    user.mfaSecret = null
    user.backupCodes = []
    await user.save()

    const { passwordHash, mfaSecret, ...safe } = user.toObject()
    return res.json({
      success: true,
      user: safe,
      message: 'MFA disabled successfully'
    })
  } catch (error) {
    console.error('MFA disable error:', error)
    return res.status(500).json({ error: 'Failed to disable MFA' })
  }
})

router.get('/auth/mfa/status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    return res.json({
      mfaEnabled: user.mfaEnabled || false,
      backupCodesCount: user.backupCodes?.length || 0
    })
  } catch (error) {
    console.error('MFA status error:', error)
    return res.status(500).json({ error: 'Failed to get MFA status' })
  }
})

// Books
router.get('/books', authMiddleware, async (req, res) => {
  try {
    const { search = '', genre = '', available = '', page = 1, limit = 12 } = req.query
    const query = {}
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { isbn: { $regex: search, $options: 'i' } },
        { genres: { $regex: search, $options: 'i' } },
      ]
    }
    if (genre) query.genres = genre
    if (available === 'true') query.availableCopies = { $gt: 0 }
    const result = await paginate(
      Book.find(query).sort({ createdAt: -1 }),
      { page: Number(page), limit: Number(limit) }
    )
    return res.json(result)
  } catch (error) {
    console.error('Error fetching books:', error)
    return res.status(500).json({ error: 'Failed to fetch books' })
  }
})

router.get('/books/genres/list', authMiddleware, async (_req, res) => {
  const genres = await Book.distinct('genres')
  res.json((genres || []).filter(Boolean).sort())
})

// "AI-like" search across title, author, isbn, and genres
router.get('/books/search/ai', authMiddleware, async (req, res) => {
  const { query = '' } = req.query
  if (!query.trim()) {
    return res.json([])
  }
  const terms = query
    .split(/[,\s]+/)
    .map(t => t.trim())
    .filter(Boolean)
  const regexes = terms.map(t => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  const or = []
  for (const r of regexes) {
    or.push({ title: r })
    or.push({ author: r })
    or.push({ isbn: r })
    or.push({ genres: r })
    or.push({ description: r })
  }
  const books = await Book.find({ $or: or })
    .sort({ rating: -1, createdAt: -1 })
    .limit(50)
  res.json(books)
})

router.get('/books/:id([0-9a-fA-F]{24})', authMiddleware, async (req, res) => {
  const book = await Book.findById(req.params.id).populate('reviews.userId', 'name email')
  if (!book) return res.status(404).json({ error: 'Not found' })
  res.json(book)
})

router.post('/books', authMiddleware, async (req, res) => {
  const data = req.body
  if (!data.title || !data.author || !data.isbn) return res.status(400).json({ error: 'title, author, isbn are required' })
  data.availableCopies = typeof data.copies === 'number' ? data.copies : 1
  const book = await Book.create(data)
  res.status(201).json(book)
})

router.put('/books/:id([0-9a-fA-F]{24})', authMiddleware, async (req, res) => {
  const prev = await Book.findById(req.params.id)
  if (!prev) return res.status(404).json({ error: 'Not found' })
  const update = { ...req.body }
  if (typeof update.copies === 'number') {
    const issued = (prev.copies || 0) - (prev.availableCopies || 0)
    update.availableCopies = Math.max(0, update.copies - issued)
  }
  const book = await Book.findByIdAndUpdate(req.params.id, update, { new: true })
  res.json(book)
})

router.delete('/books/:id([0-9a-fA-F]{24})', authMiddleware, async (req, res) => {
  await Book.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

// AI Librarian Assistant: prompt-based suggestions from catalog and user history
router.post('/ai/librarian-assistant', authMiddleware, async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim()
    if (!prompt) return res.status(400).json({ error: 'prompt is required' })

    const terms = tokenizePrompt(prompt)
    const userId = req.user.id

    const [books, issued] = await Promise.all([
      Book.find({}).limit(500),
      Transaction.find({ userId, status: 'issued' }).populate('bookId', 'title dueDate'),
    ])

    const topMatches = books
      .map(book => ({ book, score: scoreBookForPrompt(book, terms) }))
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(row => row.book)

    const hasReturnQuestion = /\b(return|due|renew|late|fine|overdue)\b/i.test(prompt)
    const now = new Date()
    const overdueCount = issued.filter(t => new Date(t.dueDate) < now).length

    const recommendations = topMatches.map(b => ({
      _id: b._id,
      title: b.title,
      author: b.author,
      genres: b.genres || [],
      rating: b.rating || 0,
      availableCopies: b.availableCopies || 0,
    }))

    let answer = ''
    if (hasReturnQuestion) {
      answer = overdueCount > 0
        ? `You currently have ${overdueCount} overdue book(s). Please return or renew them soon to avoid more fines.`
        : 'You do not have overdue books right now. You can renew active issues before the due date from the Transactions tab.'
    } else if (recommendations.length > 0) {
      const names = recommendations.slice(0, 3).map(b => b.title).join(', ')
      answer = `Based on your request, I found a few strong matches: ${names}. I prioritized genre/topic matches, higher ratings, and currently available copies.`
    } else {
      answer = 'I could not find a strong match in the current catalog. Try adding genre, topic, author, or mood keywords in your prompt.'
    }

    return res.json({
      prompt,
      answer,
      recommendations,
      issuedCount: issued.length,
      overdueCount,
    })
  } catch (error) {
    console.error('AI librarian assistant error:', error)
    return res.status(500).json({ error: 'Failed to generate AI assistant response' })
  }
})

// ==================== AI RECOMMENDATION SYSTEM ====================

// Personalized recommendations (enhanced with AI engine)
router.get('/recommendations/:userId', authMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId
    const limit = parseInt(req.query.limit) || 12
    const recommendations = await getPersonalizedRecommendations(userId, limit)
    res.json(recommendations)
  } catch (error) {
    console.error('Recommendation error:', error)
    res.status(500).json({ error: 'Failed to generate recommendations' })
  }
})

// Similar books (content-based filtering)
router.get('/books/:id([0-9a-fA-F]{24})/similar', authMiddleware, async (req, res) => {
  try {
    const bookId = req.params.id
    const limit = parseInt(req.query.limit) || 12
    const similar = await getSimilarBooks(bookId, limit)
    res.json(similar)
  } catch (error) {
    console.error('Similar books error:', error)
    res.status(500).json({ error: 'Failed to find similar books' })
  }
})

// Collaborative filtering recommendations
router.get('/recommendations/:userId/collaborative', authMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId
    const limit = parseInt(req.query.limit) || 12
    const recommendations = await getCollaborativeRecommendations(userId, limit)
    res.json(recommendations)
  } catch (error) {
    console.error('Collaborative filtering error:', error)
    res.status(500).json({ error: 'Failed to generate collaborative recommendations' })
  }
})

// Trending books (popularity-based)
router.get('/books/trending', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 12
    const days = parseInt(req.query.days) || 30
    const trending = await getTrendingBooks(limit, days)
    res.json(trending)
  } catch (error) {
    console.error('Trending books error:', error)
    res.status(500).json({ error: 'Failed to fetch trending books' })
  }
})

// Hybrid recommendations (combines multiple approaches)
router.get('/recommendations/:userId/hybrid', authMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId
    const limit = parseInt(req.query.limit) || 12
    const recommendations = await getHybridRecommendations(userId, limit)
    res.json(recommendations)
  } catch (error) {
    console.error('Hybrid recommendations error:', error)
    res.status(500).json({ error: 'Failed to generate hybrid recommendations' })
  }
})

// Genre-based recommendations
router.get('/books/genre/:genre/recommendations', authMiddleware, async (req, res) => {
  try {
    const genre = req.params.genre
    const limit = parseInt(req.query.limit) || 12
    const excludeBookId = req.query.exclude || null
    const recommendations = await getGenreRecommendations(genre, limit, excludeBookId)
    res.json(recommendations)
  } catch (error) {
    console.error('Genre recommendations error:', error)
    res.status(500).json({ error: 'Failed to fetch genre recommendations' })
  }
})

// AI-Powered New Book Suggestions based on User Interests
router.get('/recommendations/:userId/interest-based', authMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId
    const limit = parseInt(req.query.limit) || 12
    const suggestions = await getNewBookSuggestionsByInterest(userId, limit)
    res.json(suggestions)
  } catch (error) {
    console.error('Interest-based suggestions error:', error)
    res.status(500).json({ error: 'Failed to generate interest-based suggestions' })
  }
})

// Users
router.get('/users', authMiddleware, async (_req, res) => {
  const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 })
  res.json({ users })
})

// Transactions
router.get('/transactions', authMiddleware, async (_req, res) => {
  const list = await Transaction.find({}).sort({ createdAt: -1 }).populate('userId', 'name email role membershipId').populate('bookId')
  res.json({ transactions: list })
})

// Get current user's transactions (borrowed books)
router.get('/transactions/me', authMiddleware, async (req, res) => {
  try {
    const list = await Transaction.find({ userId: req.user.id, status: 'issued' })
      .sort({ createdAt: -1 })
      .populate('bookId', 'title author isbn genres rating availableCopies')
    res.json({ transactions: list })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch borrowed books' })
  }
})

router.get('/transactions/user/:userId', authMiddleware, async (req, res) => {
  const list = await Transaction.find({ userId: req.params.userId }).sort({ createdAt: -1 }).populate('userId', 'name email role membershipId').populate('bookId')
  res.json({ transactions: list })
})

router.post('/transactions/issue', authMiddleware, async (req, res) => {
  const { bookId } = req.body
  const userId = req.user.id
  const [user, book] = await Promise.all([
    User.findById(userId),
    Book.findById(bookId),
  ])
  if (!user) return res.status(404).json({ error: 'User not found' })
  if (!book || (book.availableCopies || 0) <= 0) return res.status(400).json({ error: 'Book not available' })
  if ((user.booksIssued || 0) >= (user.maxBooksAllowed || 3)) return res.status(400).json({ error: 'Issue limit reached' })
  const now = new Date()
  const due = new Date(now)
  due.setDate(due.getDate() + 14)
  const trans = await Transaction.create({ userId, bookId, issueDate: now, dueDate: due, status: 'issued', renewalCount: 0, fine: 0 })
  book.availableCopies = (book.availableCopies || 0) - 1
  await book.save()
  user.booksIssued = (user.booksIssued || 0) + 1
  await user.save()
  res.status(201).json(trans)
})

router.post('/transactions/return/:id', authMiddleware, async (req, res) => {
  const t = await Transaction.findById(req.params.id)
  if (!t) return res.status(404).json({ error: 'Not found' })
  if (t.status !== 'issued') return res.status(400).json({ error: 'Already returned' })
  const now = new Date()
  const fine = new Date(t.dueDate) < now ? Math.ceil((now - new Date(t.dueDate)) / (1000 * 60 * 60 * 24)) : 0
  t.status = 'returned'
  t.returnDate = now
  t.fine = fine
  await t.save()
  const [book, user] = await Promise.all([
    Book.findById(t.bookId),
    User.findById(t.userId),
  ])
  if (book) { book.availableCopies = (book.availableCopies || 0) + 1; await book.save() }
  if (user) { user.booksIssued = Math.max(0, (user.booksIssued || 0) - 1); user.fineAmount = (user.fineAmount || 0) + fine; await user.save() }
  res.json({ fine })
})

router.post('/transactions/renew/:id', authMiddleware, async (req, res) => {
  const t = await Transaction.findById(req.params.id)
  if (!t) return res.status(404).json({ error: 'Not found' })
  if (t.status !== 'issued') return res.status(400).json({ error: 'Cannot renew' })
  if ((t.renewalCount || 0) >= 2) return res.status(400).json({ error: 'Renewal limit reached' })
  const due = new Date(t.dueDate)
  due.setDate(due.getDate() + 7)
  t.dueDate = due
  t.renewalCount = (t.renewalCount || 0) + 1
  await t.save()
  res.json(t)
})

// Reviews
router.post('/reviews', authMiddleware, async (req, res) => {
  const { bookId, rating, review } = req.body
  const book = await Book.findById(bookId)
  if (!book) return res.status(404).json({ error: 'Book not found' })
  book.reviews = book.reviews || []
  book.reviews.push({ userId: req.user.id, rating: Number(rating) || 5, review: review || '' })
  // recompute rating
  const ratings = book.reviews.map(r => r.rating)
  book.rating = Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
  await book.save()
  res.status(201).json({ ok: true })
})

// Notifications
router.get('/notifications', authMiddleware, async (req, res) => {
  const list = await Notification.find({ $or: [{ userId: null }, { userId: req.user.id }] }).sort({ createdAt: -1 })
  res.json(list)
})

// Analytics
router.get('/analytics/dashboard', authMiddleware, async (_req, res) => {
  const [totalBooks, aggAvail, totalUsers, activeTransactions, overdueTransactions] = await Promise.all([
    Book.aggregate([{ $group: { _id: null, sum: { $sum: '$copies' } } }]),
    Book.aggregate([{ $group: { _id: null, sum: { $sum: '$availableCopies' } } }]),
    User.countDocuments(),
    Transaction.countDocuments({ status: 'issued' }),
    Transaction.countDocuments({ status: 'issued', dueDate: { $lt: new Date() } }),
  ])
  const countByBook = await Transaction.aggregate([
    { $group: { _id: '$bookId', issueCount: { $sum: 1 } } },
    { $sort: { issueCount: -1 } },
    { $limit: 5 },
  ])
  const popularBooks = await Book.populate(countByBook, { path: '_id' })
  const popular = popularBooks.map(b => ({ ...(b._id?.toObject?.() || {}), issueCount: b.issueCount }))
  res.json({
    totalBooks: totalBooks[0]?.sum || 0,
    availableBooks: aggAvail[0]?.sum || 0,
    totalUsers,
    activeTransactions,
    overdueBooks: overdueTransactions,
    popularBooks: popular,
  })
})

app.use('/api', router)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}/api`))


