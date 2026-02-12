const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getItemTransactions,
  createTransaction
} = require('../controllers/transactionController');
const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(protect, getTransactions)  // Users can see their own, admins see all
  .post(protect, authorize('admin'), createTransaction);  // Only admins can create

router.get('/item/:itemId', protect, getItemTransactions);  // Users see their own, admins see all

module.exports = router;
