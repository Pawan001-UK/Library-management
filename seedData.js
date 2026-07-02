import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import axios from 'axios'
import { connectDb } from './db.js'
import { User } from './models/User.js'
import { Book } from './models/Book.js'

dotenv.config()

async function run() {
  await connectDb()
  await User.deleteMany({})
  await Book.deleteMany({})

  const salt = await bcrypt.genSalt(10)
  const [admin, lib, user] = await User.create([
    { name: 'Admin', email: 'admin@library.com', role: 'admin', passwordHash: await bcrypt.hash('admin123', salt), membershipId: 'ADM-0001', maxBooksAllowed: 10 },
    { name: 'Librarian', email: 'librarian@library.com', role: 'librarian', passwordHash: await bcrypt.hash('lib123', salt), membershipId: 'LIB-0001', maxBooksAllowed: 6 },
    { name: 'John Doe', email: 'john@example.com', role: 'user', passwordHash: await bcrypt.hash('user123', salt), membershipId: 'USR-0001', maxBooksAllowed: 3 },
  ])

  // Seed a few canonical titles first
  await Book.create([
    { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', isbn: '9780743273565', genres: ['Classic','Fiction'], copies: 5, availableCopies: 5, rating: 4.4, description: 'A portrait of the Jazz Age in all of its decadence.', publishYear: 1925, pages: 180, language: 'English', location: 'A1-01' },
    { title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '9780061120084', genres: ['Classic','Fiction'], copies: 4, availableCopies: 4, rating: 4.8, description: 'A remarkable tale.', publishYear: 1960, pages: 281, language: 'English', location: 'A1-02' },
    { title: '1984', author: 'George Orwell', isbn: '9780451524935', genres: ['Dystopian','Science Fiction'], copies: 6, availableCopies: 6, rating: 4.7, description: 'Government surveillance and mind control.', publishYear: 1949, pages: 328, language: 'English', location: 'B2-05' },
  ])

  // Import 100-200 additional real titles from Open Library Subjects API
  // We synthesize ISBNs if missing using the work key to maintain uniqueness
  const subjects = [
    'fiction', 'fantasy', 'science_fiction', 'mystery', 'romance',
    'history', 'biography', 'business', 'technology', 'adventure',
    'thriller', 'self_help', 'philosophy', 'psychology', 'travel'
  ]

  const targetCount = 150
  const collected = []
  const seenIsbn = new Set(['9780743273565', '9780061120084', '9780451524935'])

  function makeIsbnFromKey(key) {
    // key like "/works/OL12345W" -> "OL-12345-W"
    const cleaned = String(key || '').replace(/\W+/g, '-').toUpperCase()
    return `OL-${cleaned}`
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  function randomFloat(min, max, decimals = 1) {
    const n = Math.random() * (max - min) + min
    return Number(n.toFixed(decimals))
  }

  async function fetchSubject(subject, limit = 50, offset = 0) {
    const url = `https://openlibrary.org/subjects/${encodeURIComponent(subject)}.json?limit=${limit}&offset=${offset}`
    const { data } = await axios.get(url, { timeout: 15000 })
    return data?.works || []
  }

  // Try to gather books across subjects
  for (const subject of subjects) {
    if (collected.length >= targetCount) break
    try {
      const works = await fetchSubject(subject, 50, 0)
      for (const w of works) {
        if (collected.length >= targetCount) break
        const title = w.title || ''
        const author = (w.authors && w.authors[0]?.name) || 'Unknown'
        const year = w.first_publish_year || undefined
        const genres = [subject.replace(/_/g, ' ')]
        const isbn = (w.cover_edition_key ? `OL-ED-${w.cover_edition_key}` : makeIsbnFromKey(w.key))
        if (!title || seenIsbn.has(isbn)) continue
        seenIsbn.add(isbn)
        collected.push({
          title,
          author,
          isbn,
          genres,
          copies: randomBetween(2, 6),
          availableCopies: undefined, // set below equal to copies
          rating: randomFloat(3.5, 5.0),
          description: (w.subject ? `Subjects: ${w.subject.slice(0, 5).join(', ')}` : `A ${genres[0]} title from Open Library.`),
          publishYear: year,
          pages: undefined,
          language: 'English',
          location: `S${randomBetween(1, 5)}-${String(randomBetween(1, 30)).padStart(2, '0')}`
        })
      }
    } catch (e) {
      // Skip on network error for this subject, continue others
      // console.error('Subject fetch error', subject, e?.message)
    }
  }

  // Normalize and insert
  const docs = collected.map(b => ({
    ...b,
    availableCopies: typeof b.availableCopies === 'number' ? b.availableCopies : b.copies
  }))

  if (docs.length > 0) {
    await Book.insertMany(docs, { ordered: false })
  }

  console.log(`Seeded users and ${3 + docs.length} books`)
  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })