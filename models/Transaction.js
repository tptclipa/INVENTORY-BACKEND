const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: [true, 'Please specify an item']
  },
  type: {
    type: String,
    enum: ['in', 'out'],
    required: [true, 'Please specify transaction type']
  },
  quantity: {
    type: Number,
    required: [true, 'Please specify quantity'],
    min: [1, 'Quantity must be at least 1']
  },
  // Stock on hand for this item after this transaction (for historical "stock at date")
  balanceAfter: {
    type: Number,
    min: 0
  },
  // When type is 'out' from request approval, link to the Request
  request: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Request'
  },
  notes: {
    type: String,
    trim: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
