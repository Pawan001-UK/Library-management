

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, BookOpen, Users, BarChart3, Plus, Edit2, Trash2, Eye, X, 
  BookMarked, TrendingUp, Sparkles, LogOut, LogIn, User, Bell,
  Calendar, Clock, AlertCircle, CheckCircle, RefreshCw, Star,
  Filter, Menu, Home, Settings, CreditCard, Book, Shield, Key, MessageSquare, Send
} from 'lucide-react';
import axios from 'axios';

// ==================== CONFIGURATION ====================
const API_URL = 'http://localhost:5000/api';
axios.defaults.baseURL = API_URL;

// ==================== MAIN APP COMPONENT ====================
const App = () => {
  // State Management
  const [activeTab, setActiveTab] = useState('dashboard');
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [userTransactions, setUserTransactions] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [interestBasedSuggestions, setInterestBasedSuggestions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [requiresMFA, setRequiresMFA] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  
  // MFA Setup state
  const [mfaStatus, setMfaStatus] = useState({ mfaEnabled: false, backupCodesCount: 0 });
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [mfaVerifyToken, setMfaVerifyToken] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [selectedGenre, setSelectedGenre] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [genres, setGenres] = useState([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiAssistantResult, setAiAssistantResult] = useState(null);
  const [aiAssistantLoading, setAiAssistantLoading] = useState(false);

  // Interest-based Discovery
  const [userInterest, setUserInterest] = useState('');
  const [interestSearchResults, setInterestSearchResults] = useState([]);
  const [interestSearchLoading, setInterestSearchLoading] = useState(false);

  const [trendingBooks, setTrendingBooks] = useState([]);
  const [trendingBooksLoading, setTrendingBooksLoading] = useState(false);
  const trendingStripRef = useRef(null);
  
  // Forms
  const [bookForm, setBookForm] = useState({
    title: '', author: '', isbn: '', genres: '', copies: 1, rating: 0, 
    description: '', publishYear: '', publisher: '', pages: '', language: 'English', location: ''
  });

  const [authForm, setAuthForm] = useState({
    name: '', email: '', password: '', role: 'user', phone: '', address: ''
  });

  const [reviewForm, setReviewForm] = useState({
    rating: 5, review: ''
  });

  // ==================== EFFECTS ====================
  
  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      setIsAuthenticated(true);
      setCurrentUser(JSON.parse(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchInitialData();
      fetchMFAStatus();
    }
  }, []);

  // Fetch MFA status when authenticated
  const fetchMFAStatus = async () => {
    try {
      const response = await axios.get('/auth/mfa/status');
      setMfaStatus(response.data);
    } catch (err) {
      console.error('Error fetching MFA status:', err);
    }
  };

  // Fetch data when tab changes
  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'books') {
        fetchBooks();
      } else if (activeTab === 'users' && ['admin', 'librarian'].includes(currentUser?.role)) {
        fetchUsers();
      } else if (activeTab === 'transactions') {
        if (['admin', 'librarian'].includes(currentUser?.role)) {
          fetchAllTransactions();
        } else {
          fetchUserTransactions();
        }
      }
    }
  }, [activeTab, isAuthenticated, currentPage, selectedGenre, availableOnly]);

  // Auto-dismiss messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // ==================== API FUNCTIONS ====================

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchBooks(),
        fetchStats(),
        fetchRecommendations(),
        fetchGenres(),
        fetchNotifications(),
        fetchTrendingBooks()
      ]);
      
      if (currentUser?.role === 'user') {
        await fetchUserTransactions();
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBooks = async () => {
    try {
      const params = {
        page: currentPage,
        limit: 12,
        ...(searchQuery && { search: searchQuery }),
        ...(selectedGenre && { genre: selectedGenre }),
        ...(availableOnly && { available: 'true' })
      };
      
      const response = await axios.get('/books', { params });
      setBooks(response.data.books || response.data);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (err) {
      console.error('Error fetching books:', err);
      setError('Failed to fetch books');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/users');
      setUsers(response.data.users || response.data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchAllTransactions = async () => {
    try {
      const response = await axios.get('/transactions', {
        params: { page: currentPage, limit: 20 }
      });
      setTransactions(response.data.transactions || response.data);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  };

  const fetchUserTransactions = async () => {
    try {
      // Use the /me endpoint for current user's borrowed books
      const response = await axios.get('/transactions/me');
      setUserTransactions(response.data.transactions || response.data);
    } catch (err) {
      console.error('Error fetching user transactions:', err);
      setUserTransactions([]);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/analytics/dashboard');
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchRecommendations = async () => {
    if (currentUser?._id || currentUser?.id) {
      try {
        const userId = currentUser._id || currentUser.id;
        const [personalizedResponse, interestResponse] = await Promise.all([
          axios.get(`/recommendations/${userId}`),
          axios.get(`/recommendations/${userId}/interest-based`)
        ]);
        setRecommendations(personalizedResponse.data);
        setInterestBasedSuggestions(interestResponse.data);
      } catch (err) {
        console.error('Error fetching recommendations:', err);
      }
    }
  };

  const fetchGenres = async () => {
    try {
      const response = await axios.get('/books/genres/list');
      setGenres(response.data);
    } catch (err) {
      console.error('Error fetching genres:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/notifications');
      setNotifications(response.data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const fetchTrendingBooks = async () => {
    try {
      setTrendingBooksLoading(true);
      const response = await axios.get('/books/trending', {
        params: { limit: 10, days: 30 }
      });
      setTrendingBooks(Array.isArray(response.data) ? response.data : (response.data?.books || []));
    } catch (err) {
      console.error('Error fetching trending books:', err);
      setTrendingBooks([]);
    } finally {
      setTrendingBooksLoading(false);
    }
  };

  // ==================== AUTH FUNCTIONS ====================

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (authMode === 'register') {
        const response = await axios.post('/auth/register', authForm);
        const { token, user } = response.data;
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        setIsAuthenticated(true);
        setCurrentUser(user);
        setAuthForm({ name: '', email: '', password: '', role: 'user', phone: '', address: '' });
        setSuccess(`Welcome ${user.name}!`);
        await fetchInitialData();
      } else {
        // Login flow
        const loginData = requiresMFA 
          ? { email: authForm.email, password: authForm.password, mfaToken }
          : { email: authForm.email, password: authForm.password };
        
        const response = await axios.post('/auth/login', loginData);
        
        // Check if MFA is required
        if (response.data.requiresMFA) {
          setRequiresMFA(true);
          setSuccess('Enter your MFA code');
          setMfaToken('');
        } else {
          const { token, user } = response.data;
          
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          setIsAuthenticated(true);
          setCurrentUser(user);
          setRequiresMFA(false);
          setMfaToken('');
          setAuthForm({ name: '', email: '', password: '', role: 'user', phone: '', address: '' });
          setSuccess(`Welcome ${user.name}!`);
          
          await fetchInitialData();
          await fetchMFAStatus();
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Authentication failed';
      setError(errorMessage);
      
      // Only reset MFA step if it's not an MFA verification error
      // If MFA verification fails, keep the MFA step active so user can retry
      if (requiresMFA && !errorMessage.toLowerCase().includes('mfa') && !errorMessage.toLowerCase().includes('invalid')) {
        // This shouldn't happen, but if it does, reset
        setRequiresMFA(false);
        setMfaToken('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMFASetup = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.post('/auth/mfa/setup');
      setMfaSetupData(response.data);
      setMfaVerifyToken('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerifySetup = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.post('/auth/mfa/verify-setup', { token: mfaVerifyToken });
      setMfaStatus({ mfaEnabled: true, backupCodesCount: response.data.backupCodes.length });
      setBackupCodes(response.data.backupCodes);
      setMfaSetupData(null);
      setMfaVerifyToken('');
      setSuccess('MFA enabled successfully! Save your backup codes.');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleMFADisable = async (password) => {
    try {
      setLoading(true);
      setError('');
      await axios.post('/auth/mfa/disable', { password });
      setMfaStatus({ mfaEnabled: false, backupCodesCount: 0 });
      setSuccess('MFA disabled successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setCurrentUser(null);
    setBooks([]);
    setUsers([]);
    setTransactions([]);
    setUserTransactions([]);
    setRecommendations([]);
    setActiveTab('dashboard');
    setRequiresMFA(false);
    setMfaToken('');
    setMfaSetupData(null);
    setBackupCodes([]);
    setSuccess('Logged out successfully');
  };

  // ==================== BOOK FUNCTIONS ====================

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setCurrentPage(1);
    if (query.trim()) {
      try {
        const response = await axios.get('/books/search/ai', {
          params: { query }
        });
        setBooks(response.data);
      } catch (err) {
        console.error('Search error:', err);
      }
    } else {
      fetchBooks();
    }
  };

  const askAiLibrarian = async () => {
    if (!aiPrompt.trim()) {
      setError('Please write a question for the AI librarian');
      return;
    }

    try {
      setAiAssistantLoading(true);
      const response = await axios.post('/ai/librarian-assistant', {
        prompt: aiPrompt
      });
      setAiAssistantResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get AI assistant response');
    } finally {
      setAiAssistantLoading(false);
    }
  };

  const discoverBooksByInterest = async () => {
    if (!userInterest.trim()) {
      setError('Please tell us what you are interested in reading about.');
      return;
    }

    try {
      setInterestSearchLoading(true);
      const response = await axios.get('/books/search/ai', {
        params: { query: userInterest }
      });
      setInterestSearchResults(response.data);
      if (response.data.length === 0) {
        setError('No books found matching your interests. Try different keywords.');
      }
    } catch (err) {
      setError('Failed to fetch books based on your interests.');
    } finally {
      setInterestSearchLoading(false);
    }
  };

  const addBook = async () => {
    try {
      setLoading(true);
      const bookData = {
        ...bookForm,
        genres: bookForm.genres.split(',').map(g => g.trim()).filter(g => g),
        copies: parseInt(bookForm.copies) || 1,
        rating: parseFloat(bookForm.rating) || 0,
        publishYear: parseInt(bookForm.publishYear) || undefined,
        pages: parseInt(bookForm.pages) || undefined
      };
      
      await axios.post('/books', bookData);
      await fetchBooks();
      resetForm();
      setShowModal(false);
      setSuccess('Book added successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add book');
    } finally {
      setLoading(false);
    }
  };

  const updateBook = async () => {
    try {
      setLoading(true);
      const bookData = {
        ...bookForm,
        genres: bookForm.genres.split(',').map(g => g.trim()).filter(g => g),
        copies: parseInt(bookForm.copies) || 1,
        rating: parseFloat(bookForm.rating) || 0,
        publishYear: parseInt(bookForm.publishYear) || undefined,
        pages: parseInt(bookForm.pages) || undefined
      };
      
      await axios.put(`/books/${selectedBook._id}`, bookData);
      await fetchBooks();
      resetForm();
      setShowModal(false);
      setSuccess('Book updated successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update book');
    } finally {
      setLoading(false);
    }
  };

  const deleteBook = async (id) => {
    if (window.confirm('Are you sure you want to delete this book?')) {
      try {
        await axios.delete(`/books/${id}`);
        await fetchBooks();
        setSuccess('Book deleted successfully!');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete book');
      }
    }
  };

  const issueBook = async (bookId) => {
    try {
      await axios.post('/transactions/issue', { bookId });
      await Promise.all([fetchBooks(), fetchStats(), fetchUserTransactions()]);
      setSuccess('Book issued successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to issue book');
    }
  };

  const returnBook = async (transactionId) => {
    try {
      const response = await axios.post(`/transactions/return/${transactionId}`);
      await Promise.all([fetchBooks(), fetchStats(), fetchUserTransactions()]);
      
      if (response.data.fine > 0) {
        setError(`Book returned with a fine of $${response.data.fine}`);
      } else {
        setSuccess('Book returned successfully!');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to return book');
    }
  };

  const renewBook = async (transactionId) => {
    try {
      await axios.post(`/transactions/renew/${transactionId}`);
      await fetchUserTransactions();
      setSuccess('Book renewed successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to renew book');
    }
  };

  const viewBookDetails = async (book) => {
    try {
      const response = await axios.get(`/books/${book._id}`);
      setSelectedBook(response.data);
      setModalType('viewBook');
      setShowModal(true);
    } catch (err) {
      setError('Failed to load book details');
    }
  };

  const addReview = async () => {
    try {
      await axios.post('/reviews', {
        bookId: selectedBook._id,
        ...reviewForm
      });
      setSuccess('Review added successfully!');
      setReviewForm({ rating: 5, review: '' });
      await viewBookDetails(selectedBook);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add review');
    }
  };

  // ==================== UTILITY FUNCTIONS ====================

  const resetForm = () => {
    setBookForm({
      title: '', author: '', isbn: '', genres: '', copies: 1, rating: 0,
      description: '', publishYear: '', publisher: '', pages: '', language: 'English', location: ''
    });
    setSelectedBook(null);
    setError('');
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setError('');
    
    if (type === 'editBook' && item) {
      setSelectedBook(item);
      setBookForm({
        title: item.title || '',
        author: item.author || '',
        isbn: item.isbn || '',
        genres: item.genres?.join(', ') || '',
        copies: item.copies || 1,
        rating: item.rating || 0,
        description: item.description || '',
        publishYear: item.publishYear || '',
        publisher: item.publisher || '',
        pages: item.pages || '',
        language: item.language || 'English',
        location: item.location || ''
      });
    }
    
    setShowModal(true);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isOverdue = (dueDate) => {
    return new Date(dueDate) < new Date();
  };

  // ==================== RENDER: LOGIN/REGISTER ====================

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4" style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)'
      }}>
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float"></div>
          <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{animationDelay: '1s'}}></div>
          <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{animationDelay: '2s'}}></div>
        </div>

        <div className="relative z-10 card-modern animate-fadeIn max-w-md w-full">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl blur-lg opacity-75 animate-pulse"></div>
              <div className="relative bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded-2xl shadow-xl">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-extrabold gradient-text">AI Library</h1>
              <p className="text-sm text-gray-600 font-medium mt-1">Management System</p>
            </div>
          </div>
          
          <div className="flex gap-3 mb-8 p-1 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl">
            <button
              onClick={() => {
                setAuthMode('login');
                setRequiresMFA(false);
                setMfaToken('');
                setError('');
                setSuccess('');
              }}
              className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-300 ${
                authMode === 'login' 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setAuthMode('register');
                setRequiresMFA(false);
                setMfaToken('');
                setError('');
                setSuccess('');
              }}
              className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-300 ${
                authMode === 'register' 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}
            >
              Register
            </button>
          </div>

          {/* Login Progress Indicator */}
          {authMode === 'login' && requiresMFA && (
            <div className="mb-6 animate-slideIn">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-indigo-600 rounded-full blur-md opacity-50"></div>
                    <div className="relative w-10 h-10 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-lg">1</div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Password</span>
                  <div className="w-16 h-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full"></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-600 rounded-full blur-md opacity-50 animate-pulse"></div>
                    <div className="relative w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white flex items-center justify-center text-sm font-bold shadow-lg">2</div>
                  </div>
                  <span className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">MFA Code</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'login' && requiresMFA ? (
              // MFA Step - Step 2 of Login
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300 p-6 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-indigo-600 p-2 rounded-lg">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-indigo-900">Step 2: Verify Your Identity</h3>
                      <p className="text-xs text-indigo-700">Multi-Factor Authentication Required</p>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg mb-4">
                    <p className="text-sm text-gray-700 mb-3 font-medium">Enter the 6-digit code from your authenticator app</p>
                    <input
                      type="text"
                      placeholder="000000"
                      value={mfaToken}
                      onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full px-4 py-4 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center text-3xl tracking-[0.5em] font-mono font-semibold text-indigo-900"
                      maxLength={6}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                    <p className="text-xs text-blue-800">
                      <strong>Tip:</strong> Don't have access? You can also use a backup code instead of the 6-digit code.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRequiresMFA(false);
                      setMfaToken('');
                      setError('');
                    }}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || mfaToken.length !== 6}
                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-all shadow-lg"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-5 h-5" />
                        Verify & Login
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              // Password Step - Step 1 of Login or Registration
              <>
                {authMode === 'register' && (
                  <>
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={authForm.name}
                      onChange={(e) => setAuthForm({...authForm, name: e.target.value})}
                      className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/80 backdrop-blur-sm text-gray-900 placeholder-gray-400"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={authForm.phone}
                      onChange={(e) => setAuthForm({...authForm, phone: e.target.value})}
                      className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/80 backdrop-blur-sm text-gray-900 placeholder-gray-400"
                    />
                  </>
                )}
                
                <div className="relative">
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/80 backdrop-blur-sm text-gray-900 placeholder-gray-400"
                    required
                  />
                </div>
                
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Password"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/80 backdrop-blur-sm text-gray-900 placeholder-gray-400"
                    required
                  />
                </div>

                {authMode === 'register' && (
                  <>
                    <textarea
                      placeholder="Address (Optional)"
                      value={authForm.address}
                      onChange={(e) => setAuthForm({...authForm, address: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      rows="2"
                    />
                    <select
                      value={authForm.role}
                      onChange={(e) => setAuthForm({...authForm, role: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="user">User</option>
                      <option value="librarian">Librarian</option>
                      <option value="admin">Admin</option>
                    </select>
                  </>
                )}
              </>
            )}

            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 text-red-700 p-4 rounded-xl text-sm flex items-center gap-3 animate-slideIn shadow-lg">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {success && !requiresMFA && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 text-green-700 p-4 rounded-xl text-sm flex items-center gap-3 animate-slideIn shadow-lg">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{success}</span>
              </div>
            )}

            {/* Submit button - only show for password step or registration */}
            {!(authMode === 'login' && requiresMFA) && (
              <button
                type="submit"
                disabled={loading}
                className="relative w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white py-4 rounded-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 font-bold text-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] overflow-hidden group"
              >
                <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></span>
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span>Please wait...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-6 h-6" />
                    {authMode === 'login' ? 'Login' : 'Create Account'}
                  </>
                )}
              </button>
            )}
          </form>

          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-indigo-100">
            <p className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Demo Credentials:
            </p>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Admin:</strong> admin@library.com / admin123</p>
              <p><strong>Librarian:</strong> librarian@library.com / lib123</p>
              <p><strong>User:</strong> john@example.com / user123</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDER: MAIN APPLICATION ====================

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="lg:hidden p-2 hover:bg-white/20 rounded-xl transition-all"
              >
                <Menu className="w-6 h-6 text-gray-800" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl blur-md opacity-50"></div>
                  <div className="relative bg-gradient-to-r from-indigo-600 to-purple-600 p-2.5 rounded-xl shadow-lg">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-extrabold gradient-text">AI Library System</h1>
                  <p className="text-xs text-gray-600 font-medium">Welcome, {currentUser?.name}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <button className="relative p-2.5 hover:bg-white/30 rounded-xl transition-all group">
                <Bell className="w-5 h-5 text-gray-700 group-hover:text-indigo-600 transition-colors" />
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <span className="absolute top-1 right-1 w-3 h-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-full border-2 border-white shadow-lg animate-pulse"></span>
                )}
              </button>

              {/* User Menu */}
              <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-xl border border-white/30 shadow-md">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-1.5 rounded-lg">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-800">{currentUser?.name}</span>
                <span className="text-xs px-2 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold shadow-sm">
                  {currentUser?.role}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar Navigation */}
        <aside className={`${showSidebar ? 'block' : 'hidden'} lg:block w-64 glass h-[calc(100vh-5rem)] overflow-y-auto p-6 sticky top-20 animate-slideIn`}>
          <nav className="space-y-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl transform scale-105'
                  : 'text-gray-700 hover:bg-white/30 hover:transform hover:scale-105'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="font-semibold">Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('books')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                activeTab === 'books'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl transform scale-105'
                  : 'text-gray-700 hover:bg-white/30 hover:transform hover:scale-105'
              }`}
            >
              <BookMarked className="w-5 h-5" />
              <span className="font-semibold">Books</span>
            </button>

            <button
              onClick={() => setActiveTab('transactions')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                activeTab === 'transactions'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl transform scale-105'
                  : 'text-gray-700 hover:bg-white/30 hover:transform hover:scale-105'
              }`}
            >
              <Calendar className="w-5 h-5" />
              <span className="font-semibold">My Books</span>
            </button>

            {['admin', 'librarian'].includes(currentUser?.role) && (
              <>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                    activeTab === 'users'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl transform scale-105'
                      : 'text-gray-700 hover:bg-white/30 hover:transform hover:scale-105'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="font-semibold">Users</span>
                </button>

                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                    activeTab === 'analytics'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl transform scale-105'
                      : 'text-gray-700 hover:bg-white/30 hover:transform hover:scale-105'
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                  <span className="font-semibold">Analytics</span>
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl transform scale-105'
                  : 'text-gray-700 hover:bg-white/30 hover:transform hover:scale-105'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="font-semibold">Settings</span>
            </button>
          </nav>

          {/* User Info Card */}
          <div className="mt-8 p-5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-xl border border-white/20">
            <p className="text-xs font-bold text-white/90 mb-2 uppercase tracking-wider">Membership Info</p>
            <p className="text-base font-mono text-white font-bold bg-white/20 px-3 py-2 rounded-lg">{currentUser?.membershipId}</p>
            <div className="mt-4 pt-4 border-t border-white/30">
              <div className="flex justify-between items-center">
                <span className="text-white/90 text-sm font-medium">Books Issued:</span>
                <span className="font-bold text-white text-lg bg-white/20 px-3 py-1 rounded-lg">{currentUser?.booksIssued || 0}</span>
              </div>
              {currentUser?.fineAmount > 0 && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-white/90 text-sm font-medium">Fine Amount:</span>
                  <span className="font-bold text-red-200 text-lg bg-red-500/30 px-3 py-1 rounded-lg">${currentUser?.fineAmount}</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Alert Messages */}
          {error && (
            <div className="mb-4 glass border-2 border-red-300 text-red-700 p-4 rounded-xl flex items-center justify-between animate-slideIn shadow-xl">
              <div className="flex items-center gap-3">
                <div className="bg-red-500 p-2 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold">{error}</span>
              </div>
              <button onClick={() => setError('')} className="text-red-700 hover:text-red-900 p-1 hover:bg-red-100 rounded-lg transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {success && (
            <div className="mb-4 glass border-2 border-green-300 text-green-700 p-4 rounded-xl flex items-center justify-between animate-slideIn shadow-xl">
              <div className="flex items-center gap-3">
                <div className="bg-green-500 p-2 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold">{success}</span>
              </div>
              <button onClick={() => setSuccess('')} className="text-green-700 hover:text-green-900 p-1 hover:bg-green-100 rounded-lg transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fadeIn">
              <div>
                <h2 className="text-4xl font-extrabold gradient-text mb-2">Dashboard Overview</h2>
                <p className="text-gray-600">Welcome back! Here's what's happening.</p>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card-modern group hover:scale-105 transition-transform duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-semibold uppercase tracking-wider mb-1">Total Books</p>
                      <p className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mt-2">{stats.totalBooks || 0}</p>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 bg-indigo-200 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                      <div className="relative bg-gradient-to-r from-indigo-500 to-purple-500 p-4 rounded-xl shadow-lg">
                        <BookOpen className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card-modern group hover:scale-105 transition-transform duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-semibold uppercase tracking-wider mb-1">Available Books</p>
                      <p className="text-4xl font-extrabold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent mt-2">{stats.availableBooks || 0}</p>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-200 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                      <div className="relative bg-gradient-to-r from-green-500 to-emerald-500 p-4 rounded-xl shadow-lg">
                        <TrendingUp className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card-modern group hover:scale-105 transition-transform duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-semibold uppercase tracking-wider mb-1">Active Issues</p>
                      <p className="text-4xl font-extrabold bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent mt-2">{stats.activeTransactions || 0}</p>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 bg-orange-200 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                      <div className="relative bg-gradient-to-r from-orange-500 to-amber-500 p-4 rounded-xl shadow-lg">
                        <Calendar className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card-modern group hover:scale-105 transition-transform duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-semibold uppercase tracking-wider mb-1">Overdue Books</p>
                      <p className="text-4xl font-extrabold bg-gradient-to-r from-red-500 to-pink-600 bg-clip-text text-transparent mt-2">{stats.overdueBooks || 0}</p>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 bg-red-200 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                      <div className="relative bg-gradient-to-r from-red-500 to-pink-500 p-4 rounded-xl shadow-lg">
                        <AlertCircle className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Interest-Based Suggestions */}
              {interestBasedSuggestions.length > 0 && (
                <div className="card-modern">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-purple-400 rounded-xl blur-lg opacity-50 animate-pulse"></div>
                      <div className="relative bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-xl shadow-lg">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-extrabold gradient-text">🎯 New Books Based on Your Interests</h3>
                      <p className="text-sm text-gray-600">AI analyzed your reading history to suggest these new books</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {interestBasedSuggestions.map((book, idx) => (
                      <div 
                        key={book._id} 
                        className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50/50 border-2 border-purple-200/50 p-5 rounded-2xl hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 animate-fadeIn"
                        style={{animationDelay: `${idx * 0.1}s`}}
                        onClick={() => viewBookDetails(book)}
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-200 to-pink-200 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                        <div className="relative z-10">
                          {/* Match Badge */}
                          {book.matchType && (
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full font-bold shadow-md">
                                {book.matchType.includes('author') ? '⭐ Favorite Author' : 
                                 book.matchType.includes('genre') ? '🎯 Your Genre' :
                                 book.matchType.includes('popular') ? '🔥 Popular' :
                                 book.matchType.includes('new') ? '🆕 New Release' : '✨ Explore'}
                              </span>
                            </div>
                          )}
                          <h4 className="font-bold text-gray-800 mb-2 line-clamp-2 text-lg">{book.title}</h4>
                          <p className="text-sm text-gray-600 mb-3 font-medium">by {book.author}</p>
                          <div className="flex items-center gap-2 flex-wrap mb-3">
                            <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1.5 rounded-full font-semibold shadow-md">
                              {book.genres?.[0]}
                            </span>
                            <span className="text-yellow-500 text-sm flex items-center gap-1 font-semibold">
                              <Star className="w-4 h-4 fill-current" />
                              {book.rating}
                            </span>
                          </div>
                          {/* Why Recommended */}
                          {book.whyRecommended && (
                            <div className="mb-4 p-3 bg-white/70 rounded-lg border border-purple-200">
                              <p className="text-xs font-semibold text-purple-700 mb-1">💡 Why Recommended:</p>
                              <p className="text-xs text-gray-700 leading-relaxed">{book.whyRecommended}</p>
                            </div>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              issueBook(book._id);
                            }}
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg transition-all transform hover:scale-105"
                          >
                            Borrow This Book
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Discover Books by Interest */}
              <div className="card-modern">
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-400 rounded-xl blur-lg opacity-50 animate-pulse"></div>
                    <div className="relative bg-gradient-to-r from-blue-500 to-indigo-500 p-3 rounded-xl shadow-lg">
                      <Search className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold gradient-text">Discover Books by Interest</h3>
                    <p className="text-sm text-gray-600">Tell us what you're in the mood for, and we'll extract matching books from the entire library.</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <input
                    type="text"
                    value={userInterest}
                    onChange={(e) => setUserInterest(e.target.value)}
                    placeholder="e.g., Space Travel, Medieval History, Robotics, Mystery..."
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    onKeyDown={(e) => e.key === 'Enter' && discoverBooksByInterest()}
                  />
                  <button
                    onClick={discoverBooksByInterest}
                    disabled={interestSearchLoading}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {interestSearchLoading ? 'Searching...' : 'Find Books'}
                  </button>
                </div>

                {interestSearchResults.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
                    {interestSearchResults.map((book) => (
                      <div key={book._id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-xl transition-all">
                        <h4 className="font-bold text-gray-800 line-clamp-2">{book.title}</h4>
                        <p className="text-sm text-gray-600 mt-1 mb-2">by {book.author}</p>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {book.genres?.slice(0, 2).map(g => (
                            <span key={g} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">{g}</span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                          <span className={`text-xs font-bold ${book.availableCopies > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {book.availableCopies > 0 ? 'Available' : 'Unavailable'}
                          </span>
                          <button
                            onClick={() => viewBookDetails(book)}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Recommendations */}
              <div className="card-modern">
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-yellow-400 rounded-xl blur-lg opacity-50 animate-pulse"></div>
                    <div className="relative bg-gradient-to-r from-yellow-400 to-orange-500 p-3 rounded-xl shadow-lg">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold gradient-text">AI Recommendations for You</h3>
                    <p className="text-sm text-gray-600">Personalized just for you</p>
                  </div>
                </div>

                {/* Current Trending Books */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-extrabold text-gray-800">Current Trending Books</h4>
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!trendingBooks || trendingBooks.length === 0}
                        onClick={() => trendingStripRef.current?.scrollBy({ left: -260, behavior: 'smooth' })}
                      >
                        Prev
                      </button>
                      <button
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!trendingBooks || trendingBooks.length === 0}
                        onClick={() => trendingStripRef.current?.scrollBy({ left: 260, behavior: 'smooth' })}
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  {trendingBooksLoading ? (
                    <p className="text-sm text-gray-600">Loading trending books...</p>
                  ) : trendingBooks.length > 0 ? (
                    <div ref={trendingStripRef} className="flex gap-4 overflow-x-auto pb-2 scroll-smooth">
                      {trendingBooks.map((book) => (
                        <div
                          key={book._id}
                          className="min-w-[220px] bg-white border border-indigo-100 rounded-xl p-4 hover:shadow-lg transition-all cursor-pointer"
                          onClick={() => viewBookDetails(book)}
                        >
                          <h5 className="font-bold text-gray-800 line-clamp-2">{book.title}</h5>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-1">by {book.author}</p>
                          <div className="flex items-center justify-between text-xs mt-3">
                            <span className="text-yellow-600 font-semibold">⭐ {book.rating || 0}</span>
                            <span className={`${book.availableCopies > 0 ? 'text-green-600' : 'text-red-600'} font-semibold`}>
                              {book.availableCopies > 0 ? 'Available' : 'Unavailable'}
                            </span>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm hover:bg-blue-600 transition-all"
                              onClick={(e) => {
                                e.stopPropagation()
                                viewBookDetails(book)
                              }}
                            >
                              View
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No trending books found.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recommendations.length > 0 ? recommendations.map((book, idx) => (
                    <div 
                      key={book._id} 
                      className="group relative overflow-hidden bg-gradient-to-br from-white to-indigo-50/50 border-2 border-indigo-200/50 p-5 rounded-2xl hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 animate-fadeIn"
                      style={{animationDelay: `${idx * 0.1}s`}}
                      onClick={() => viewBookDetails(book)}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                      <div className="relative z-10">
                        <h4 className="font-bold text-gray-800 mb-2 line-clamp-2 text-lg">{book.title}</h4>
                        <p className="text-sm text-gray-600 mb-3 font-medium">by {book.author}</p>
                        <div className="flex items-center gap-2 flex-wrap mb-4">
                          <span className="text-xs bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1.5 rounded-full font-semibold shadow-md">
                            {book.genres?.[0]}
                          </span>
                          <span className="text-yellow-500 text-sm flex items-center gap-1 font-semibold">
                            <Star className="w-4 h-4 fill-current" />
                            {book.rating}
                          </span>
                        </div>
                        {book.whyRecommended && (
                          <p className="text-xs text-gray-600 mb-4 leading-relaxed line-clamp-3">
                            {book.whyRecommended}
                          </p>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            issueBook(book._id);
                          }}
                          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg transition-all transform hover:scale-105"
                        >
                          Borrow Now
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-3 text-center py-12 text-gray-500">
                      <div className="inline-block p-4 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-full mb-4">
                        <Sparkles className="w-12 h-12 text-yellow-500 animate-float" />
                      </div>
                      <p className="text-lg font-semibold">Start borrowing books to get personalized recommendations!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Librarian Assistant */}
              <div className="card-modern">
                <div className="flex items-center gap-3 mb-5">
                  <div className="relative">
                    <div className="absolute inset-0 bg-indigo-300 rounded-xl blur-lg opacity-50"></div>
                    <div className="relative bg-gradient-to-r from-indigo-600 to-blue-600 p-3 rounded-xl shadow-lg">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold gradient-text">AI Librarian Assistant</h3>
                    <p className="text-sm text-gray-600">Ask in natural language and get instant suggestions</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={3}
                    placeholder="Example: suggest 3 mystery books under high rating, or how to avoid late fines?"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  />
                  <button
                    onClick={askAiLibrarian}
                    disabled={aiAssistantLoading}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    {aiAssistantLoading ? 'Thinking...' : 'Ask AI'}
                  </button>
                </div>

                {aiAssistantResult && (
                  <div className="mt-5 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <p className="text-sm font-semibold text-indigo-800 mb-2">Assistant Response</p>
                    <p className="text-sm text-gray-700 mb-4">{aiAssistantResult.answer}</p>

                    {aiAssistantResult.recommendations?.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {aiAssistantResult.recommendations.map((book) => (
                          <div key={book._id} className="bg-white border border-indigo-100 rounded-lg p-3">
                            <p className="font-semibold text-sm text-gray-800 line-clamp-2">{book.title}</p>
                            <p className="text-xs text-gray-600 mb-2">by {book.author}</p>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-yellow-600 font-semibold">Rating: {book.rating || 0}</span>
                              <span className={`${book.availableCopies > 0 ? 'text-green-600' : 'text-red-600'} font-semibold`}>
                                {book.availableCopies > 0 ? 'Available' : 'Unavailable'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Popular Books */}
              {stats.popularBooks && stats.popularBooks.length > 0 && (
                <div className="card-modern">
                  <h3 className="text-2xl font-extrabold gradient-text mb-6">Most Popular Books</h3>
                  <div className="space-y-4">
                    {stats.popularBooks.map((book, index) => (
                      <div key={index} className="group flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl hover:shadow-lg transition-all border border-indigo-100/50 hover:border-indigo-300">
                        <div className="relative flex-shrink-0">
                          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full blur-md opacity-30"></div>
                          <div className="relative w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                            {index + 1}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-800 text-lg">{book.title}</p>
                          <p className="text-sm text-gray-600 font-medium">{book.author}</p>
                        </div>
                        <div className="bg-white px-4 py-2 rounded-lg border border-indigo-200">
                          <span className="text-sm font-bold text-indigo-600">{book.issueCount}</span>
                          <span className="text-xs text-gray-500 ml-1">issues</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Books Tab */}
          {activeTab === 'books' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-4xl font-extrabold gradient-text mb-2">Book Catalog</h2>
                  <p className="text-gray-600">Explore our vast collection of books</p>
                </div>
                {['admin', 'librarian'].includes(currentUser?.role) && (
                  <button
                    onClick={() => openModal('addBook')}
                    className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:shadow-2xl transition-all transform hover:scale-105 font-semibold overflow-hidden group"
                  >
                    <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></span>
                    <Plus className="w-5 h-5 relative z-10" />
                    <span className="relative z-10">Add Book</span>
                  </button>
                )}
              </div>

              {/* Search and Filters */}
              <div className="card-modern">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="AI-powered search: title, author, ISBN, genre..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/80 backdrop-blur-sm text-gray-900 placeholder-gray-400 font-medium"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <select
                      value={selectedGenre}
                      onChange={(e) => {
                        setSelectedGenre(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="flex-1 px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/80 backdrop-blur-sm text-gray-900 font-medium"
                    >
                      <option value="">All Genres</option>
                      {genres.map(genre => (
                        <option key={genre} value={genre}>{genre}</option>
                      ))}
                    </select>
                    
                    <button
                      onClick={() => {
                        setAvailableOnly(!availableOnly);
                        setCurrentPage(1);
                      }}
                      className={`px-4 py-3.5 rounded-xl border-2 transition-all font-semibold ${
                        availableOnly 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-lg transform scale-105' 
                          : 'bg-white/80 text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-indigo-300'
                      }`}
                    >
                      <Filter className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Books Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {books.map((book, idx) => (
                  <div key={book._id} className="group card-modern hover:scale-105 transition-transform duration-300 animate-fadeIn" style={{animationDelay: `${idx * 0.05}s`}}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-800 line-clamp-2 mb-1">{book.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">by {book.author}</p>
                      </div>
                      {book.rating > 0 && (
                        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-semibold text-yellow-700">{book.rating}</span>
                        </div>
                      )}
                    </div>

                    {book.genres && book.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {book.genres.slice(0, 2).map((genre, idx) => (
                          <span key={idx} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                            {genre}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        book.availableCopies > 0 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {book.availableCopies > 0 ? `${book.availableCopies} Available` : 'Not Available'}
                      </span>
                      {book.location && (
                        <span className="text-gray-500 text-xs">📍 {book.location}</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => viewBookDetails(book)}
                        className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm hover:bg-blue-600 transition-all flex items-center justify-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      
                      {book.availableCopies > 0 && currentUser?.role === 'user' && (
                        <button
                          onClick={() => issueBook(book._id)}
                          className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm hover:bg-green-600 transition-all"
                        >
                          Borrow
                        </button>
                      )}
                      
                      {['admin', 'librarian'].includes(currentUser?.role) && (
                        <>
                          <button
                            onClick={() => openModal('editBook', book)}
                            className="bg-yellow-500 text-white p-2 rounded-lg hover:bg-yellow-600 transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {currentUser?.role === 'admin' && (
                            <button
                              onClick={() => deleteBook(book._id)}
                              className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {['admin', 'librarian'].includes(currentUser?.role) ? 'All Transactions' : 'My Borrowed Books'}
              </h2>

              <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['admin', 'librarian'].includes(currentUser?.role) && (
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">User</th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Book</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Issue Date</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Due Date</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(currentUser?.role === 'user' ? userTransactions : transactions).map(trans => (
                        <tr key={trans._id} className="hover:bg-gray-50">
                          {['admin', 'librarian'].includes(currentUser?.role) && (
                            <td className="px-6 py-4 text-sm">
                              <div>
                                <p className="font-medium text-gray-800">{trans.userId?.name}</p>
                                <p className="text-gray-500 text-xs">{trans.userId?.email}</p>
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-4 text-sm">
                            <div>
                              <p className="font-medium text-gray-800">{trans.bookId?.title}</p>
                              <p className="text-gray-500 text-xs">{trans.bookId?.author}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDate(trans.issueDate)}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className={isOverdue(trans.dueDate) && trans.status === 'issued' ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                              {formatDate(trans.dueDate)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              trans.status === 'returned' ? 'bg-gray-100 text-gray-700' :
                              trans.status === 'overdue' ? 'bg-red-100 text-red-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {trans.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              {trans.status === 'issued' && currentUser?.role === 'user' && (
                                <>
                                  <button
                                    onClick={() => returnBook(trans._id)}
                                    className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-all"
                                  >
                                    Return
                                  </button>
                                  {trans.renewalCount < 2 && (
                                    <button
                                      onClick={() => renewBook(trans._id)}
                                      className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 transition-all flex items-center gap-1"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      Renew
                                    </button>
                                  )}
                                </>
                              )}
                              {trans.status === 'issued' && ['admin', 'librarian'].includes(currentUser?.role) && (
                                <button
                                  onClick={() => returnBook(trans._id)}
                                  className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-all"
                                >
                                  Mark Returned
                                </button>
                              )}
                              {trans.fine > 0 && (
                                <span className="text-red-600 text-xs font-semibold">
                                  Fine: ${trans.fine}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {(currentUser?.role === 'user' ? userTransactions : transactions).length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Book className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No transactions found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Users Tab (Admin/Librarian only) */}
          {activeTab === 'users' && ['admin', 'librarian'].includes(currentUser?.role) && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
              
              <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Member ID</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Books Issued</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Fine</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users.map(user => (
                        <tr key={user._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-mono text-gray-600">
                            {user.membershipId}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-800">
                            {user.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {user.email}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                              user.role === 'librarian' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-center">
                            {user.booksIssued || 0} / {user.maxBooksAllowed || 3}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {user.fineAmount > 0 ? (
                              <span className="text-red-600 font-semibold">${user.fineAmount}</span>
                            ) : (
                              <span className="text-gray-400">$0</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              user.isActive 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">Account Settings</h2>
              
              {/* MFA Section */}
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-xl font-bold text-gray-800">Multi-Factor Authentication</h3>
                </div>
                
                {!mfaStatus.mfaEnabled ? (
                  <div className="space-y-4">
                    <p className="text-gray-600">
                      Add an extra layer of security to your account by enabling two-factor authentication.
                    </p>
                    
                    {!mfaSetupData ? (
                      <button
                        onClick={handleMFASetup}
                        disabled={loading}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                      >
                        <Shield className="w-5 h-5" />
                        Enable MFA
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Step 1: Scan QR Code</p>
                          <p className="text-xs text-gray-600 mb-4">
                            Scan this QR code with an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator
                          </p>
                          <div className="flex justify-center bg-white p-4 rounded-lg">
                            <img src={mfaSetupData.qrCode} alt="MFA QR Code" className="w-48 h-48" />
                          </div>
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            Or enter this code manually: <code className="bg-white px-2 py-1 rounded font-mono">{mfaSetupData.manualEntryKey}</code>
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-2">Step 2: Enter Verification Code</p>
                          <p className="text-xs text-gray-600 mb-2">
                            Enter the 6-digit code from your authenticator app to verify setup
                          </p>
                          <input
                            type="text"
                            placeholder="000000"
                            value={mfaVerifyToken}
                            onChange={(e) => setMfaVerifyToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-xl tracking-widest font-mono mb-3"
                            maxLength={6}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleMFAVerifySetup}
                              disabled={loading || mfaVerifyToken.length !== 6}
                              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                            >
                              Verify & Enable
                            </button>
                            <button
                              onClick={() => {
                                setMfaSetupData(null);
                                setMfaVerifyToken('');
                              }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold">MFA is enabled</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Backup codes remaining: <strong>{mfaStatus.backupCodesCount}</strong>
                    </p>
                    
                    {backupCodes.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                        <p className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Save Your Backup Codes</p>
                        <p className="text-xs text-yellow-700 mb-3">
                          These codes can be used to access your account if you lose your authenticator device. Save them in a safe place!
                        </p>
                        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                          {backupCodes.map((code, idx) => (
                            <div key={idx} className="bg-white px-3 py-2 rounded border border-yellow-300">
                              {code}
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => setBackupCodes([])}
                          className="mt-3 text-xs text-yellow-700 hover:text-yellow-900"
                        >
                          I've saved these codes
                        </button>
                      </div>
                    )}
                    
                    <button
                      onClick={() => {
                        const password = prompt('Enter your password to disable MFA:');
                        if (password) {
                          handleMFADisable(password);
                        }
                      }}
                      className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-all"
                    >
                      Disable MFA
                    </button>
                  </div>
                )}
              </div>
              
              {/* User Info Section */}
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Account Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-semibold text-gray-800">{currentUser?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-semibold text-gray-800">{currentUser?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Membership ID</p>
                    <p className="font-mono font-semibold text-gray-800">{currentUser?.membershipId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Role</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      currentUser?.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      currentUser?.role === 'librarian' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {currentUser?.role}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && ['admin', 'librarian'].includes(currentUser?.role) && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">Analytics & Reports</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-700">Total Collection</h3>
                    <BookOpen className="w-8 h-8 text-indigo-600" />
                  </div>
                  <p className="text-3xl font-bold text-gray-800">{stats.totalBooks || 0}</p>
                  <p className="text-sm text-gray-500 mt-2">Books in library</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-700">Active Members</h3>
                    <Users className="w-8 h-8 text-purple-600" />
                  </div>
                  <p className="text-3xl font-bold text-gray-800">{stats.totalUsers || 0}</p>
                  <p className="text-sm text-gray-500 mt-2">Registered users</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-700">Total Fines</h3>
                    <CreditCard className="w-8 h-8 text-red-600" />
                  </div>
                  <p className="text-3xl font-bold text-gray-800">${stats.totalFines || 0}</p>
                  <p className="text-sm text-gray-500 mt-2">Outstanding fines</p>
                </div>
              </div>

              {stats.popularBooks && stats.popularBooks.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Top 5 Most Borrowed Books</h3>
                  <div className="space-y-3">
                    {stats.popularBooks.map((book, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                        <div className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{book.title}</p>
                          <p className="text-sm text-gray-600">{book.author}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-indigo-600">{book.issueCount}</p>
                          <p className="text-xs text-gray-500">issues</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">
                {modalType === 'addBook' && 'Add New Book'}
                {modalType === 'editBook' && 'Edit Book'}
                {modalType === 'viewBook' && 'Book Details'}
              </h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* View Book Modal */}
            {modalType === 'viewBook' && selectedBook && (
              <div className="space-y-6">
                <div className="border-b pb-4">
                  <h4 className="font-bold text-2xl text-gray-800 mb-2">{selectedBook.title}</h4>
                  <p className="text-lg text-gray-600">by {selectedBook.author}</p>
                </div>

                {selectedBook.aiSummary && (
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-sm font-semibold mb-2 flex items-center gap-2 text-gray-700">
                      <Sparkles className="w-5 h-5 text-yellow-500" />
                      AI-Generated Summary
                    </p>
                    <p className="text-sm text-gray-700">{selectedBook.aiSummary}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="font-semibold text-gray-700">ISBN:</span>
                    <p className="text-gray-600 mt-1">{selectedBook.isbn}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="font-semibold text-gray-700">Rating:</span>
                    <p className="text-yellow-500 mt-1 flex items-center gap-1">
                      <Star className="w-4 h-4 fill-current" />
                      {selectedBook.rating}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="font-semibold text-gray-700">Total Copies:</span>
                    <p className="text-gray-600 mt-1">{selectedBook.copies}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="font-semibold text-gray-700">Available:</span>
                    <p className={`mt-1 font-semibold ${selectedBook.availableCopies > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedBook.availableCopies}
                    </p>
                  </div>
                  {selectedBook.publishYear && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="font-semibold text-gray-700">Published:</span>
                      <p className="text-gray-600 mt-1">{selectedBook.publishYear}</p>
                    </div>
                  )}
                  {selectedBook.pages && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="font-semibold text-gray-700">Pages:</span>
                      <p className="text-gray-600 mt-1">{selectedBook.pages}</p>
                    </div>
                  )}
                  {selectedBook.language && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="font-semibold text-gray-700">Language:</span>
                      <p className="text-gray-600 mt-1">{selectedBook.language}</p>
                    </div>
                  )}
                  {selectedBook.location && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="font-semibold text-gray-700">Location:</span>
                      <p className="text-gray-600 mt-1">{selectedBook.location}</p>
                    </div>
                  )}
                </div>

                {selectedBook.genres && selectedBook.genres.length > 0 && (
                  <div>
                    <p className="font-semibold text-sm mb-2 text-gray-700">Genres:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedBook.genres.map((genre, idx) => (
                        <span key={idx} className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedBook.description && (
                  <div>
                    <p className="font-semibold text-sm mb-2 text-gray-700">Description:</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{selectedBook.description}</p>
                  </div>
                )}

                {/* Reviews Section */}
                {selectedBook.reviews && selectedBook.reviews.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="font-semibold text-sm mb-3 text-gray-700">User Reviews:</p>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {selectedBook.reviews.map((review, idx) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-gray-800">{review.userId?.name}</span>
                            <div className="flex items-center gap-1 text-yellow-500">
                              {[...Array(review.rating)].map((_, i) => (
                                <Star key={i} className="w-3 h-3 fill-current" />
                              ))}
                            </div>
                          </div>
                          {review.review && <p className="text-sm text-gray-600">{review.review}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Review Form */}
                {currentUser?.role === 'user' && (
                  <div className="border-t pt-4">
                    <p className="font-semibold text-sm mb-3 text-gray-700">Add Your Review:</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Rating</label>
                        <select
                          value={reviewForm.rating}
                          onChange={(e) => setReviewForm({...reviewForm, rating: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
                          <option value="4">⭐⭐⭐⭐ Good</option>
                          <option value="3">⭐⭐⭐ Average</option>
                          <option value="2">⭐⭐ Below Average</option>
                          <option value="1">⭐ Poor</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Review (Optional)</label>
                        <textarea
                          value={reviewForm.review}
                          onChange={(e) => setReviewForm({...reviewForm, review: e.target.value})}
                          placeholder="Share your thoughts about this book..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          rows="3"
                        />
                      </div>
                      <button
                        onClick={addReview}
                        className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-all"
                      >
                        Submit Review
                      </button>
                    </div>
                  </div>
                )}

                {selectedBook.availableCopies > 0 && currentUser?.role === 'user' && (
                  <button
                    onClick={() => {
                      issueBook(selectedBook._id);
                      setShowModal(false);
                    }}
                    className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-all font-medium text-lg"
                  >
                    Borrow This Book
                  </button>
                )}
              </div>
            )}

            {/* Add/Edit Book Modal */}
            {(modalType === 'addBook' || modalType === 'editBook') && (
              <form onSubmit={(e) => {
                e.preventDefault();
                modalType === 'addBook' ? addBook() : updateBook();
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                      type="text"
                      placeholder="Book Title"
                      value={bookForm.title}
                      onChange={(e) => setBookForm({...bookForm, title: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Author *</label>
                    <input
                      type="text"
                      placeholder="Author Name"
                      value={bookForm.author}
                      onChange={(e) => setBookForm({...bookForm, author: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ISBN *</label>
                    <input
                      type="text"
                      placeholder="ISBN Number"
                      value={bookForm.isbn}
                      onChange={(e) => setBookForm({...bookForm, isbn: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                    <input
                      type="text"
                      placeholder="Publisher Name"
                      value={bookForm.publisher}
                      onChange={(e) => setBookForm({...bookForm, publisher: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Genres (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="Fiction, Classic, Adventure"
                    value={bookForm.genres}
                    onChange={(e) => setBookForm({...bookForm, genres: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    placeholder="Book description..."
                    value={bookForm.description}
                    onChange={(e) => setBookForm({...bookForm, description: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    rows="3"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Copies *</label>
                    <input
                      type="number"
                      placeholder="1"
                      min="1"
                      value={bookForm.copies}
                      onChange={(e) => setBookForm({...bookForm, copies: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      placeholder="4.5"
                      value={bookForm.rating}
                      onChange={(e) => setBookForm({...bookForm, rating: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                    <input
                      type="number"
                      placeholder="2024"
                      value={bookForm.publishYear}
                      onChange={(e) => setBookForm({...bookForm, publishYear: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pages</label>
                    <input
                      type="number"
                      placeholder="300"
                      value={bookForm.pages}
                      onChange={(e) => setBookForm({...bookForm, pages: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                    <input
                      type="text"
                      placeholder="English"
                      value={bookForm.language}
                      onChange={(e) => setBookForm({...bookForm, language: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Shelf Location</label>
                    <input
                      type="text"
                      placeholder="A1-01"
                      value={bookForm.location}
                      onChange={(e) => setBookForm({...bookForm, location: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all font-medium"
                  >
                    {loading ? 'Saving...' : (modalType === 'addBook' ? 'Add Book' : 'Update Book')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;