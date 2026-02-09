const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getItemTransactions,
  createTransaction
} = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

router.route('/')
  .get(protect, getTransactions)
  .post(protect, createTransaction);

router.get('/item/:itemId', protect, getItemTransactions);

module.exports = router;
