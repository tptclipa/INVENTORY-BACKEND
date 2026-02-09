const express = require('express');
const router = express.Router();
const {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  getLowStockItems
} = require('../controllers/itemController');
const { protect, authorize } = require('../middleware/auth');

router.get('/low-stock', protect, getLowStockItems);

router.route('/')
  .get(protect, getItems)
  .post(protect, createItem);

router.route('/:id')
  .get(protect, getItem)
  .put(protect, updateItem)
  .delete(protect, authorize('admin'), deleteItem);

module.exports = router;
