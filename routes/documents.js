const express = require('express');
const router = express.Router();
const {
  generateInventoryReport,
  generateLowStockAlert,
  generateTransactionReport,
  generateItemLabel
} = require('../controllers/documentController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.post('/inventory-report', protect, generateInventoryReport);
router.post('/low-stock-alert', protect, generateLowStockAlert);
router.post('/transaction-report', protect, generateTransactionReport);
router.post('/item-label/:id', protect, generateItemLabel);

module.exports = router;
