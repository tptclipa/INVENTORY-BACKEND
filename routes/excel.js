const express = require('express');
const router = express.Router();
const {
  exportInventoryReport,
  exportLowStockAlert,
  exportTransactionReport,
  exportFullData
} = require('../controllers/excelController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.post('/inventory-report', protect, exportInventoryReport);
router.post('/low-stock-alert', protect, exportLowStockAlert);
router.post('/transaction-report', protect, authorize('admin'), exportTransactionReport);
router.post('/full-export', protect, exportFullData);

module.exports = router;
