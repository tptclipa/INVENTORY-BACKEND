const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');
// RIS feature ready

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Route files
const auth = require('./routes/auth');
const categories = require('./routes/categories');
const items = require('./routes/items');
const transactions = require('./routes/transactions');
const requests = require('./routes/requests');
const documents = require('./routes/documents');
const excel = require('./routes/excel');
const ris = require('./routes/ris');

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: false, // Set to true only if using cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Mount routers
app.use('/api/auth', auth);
app.use('/api/categories', categories);
app.use('/api/items', items);
app.use('/api/transactions', transactions);
app.use('/api/requests', requests);
app.use('/api/documents', documents);
app.use('/api/excel', excel);
app.use('/api/ris', ris);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Inventory Management API',
    version: '1.0.0'
  });
});

app.get('/api', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is running',
    endpoints: [
      '/api/auth',
      '/api/categories',
      '/api/items',
      '/api/transactions',
      '/api/requests',
      '/api/documents',
      '/api/excel',
      '/api/ris'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
  });
}

// Export for Vercel serverless
module.exports = app;
