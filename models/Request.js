const mongoose = require('mongoose');

const requestItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    trim: true
  }
}, { _id: true });

const requestSchema = new mongoose.Schema({
  // Support both single item (legacy) and multiple items (new cart system)
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item'
  },
  quantity: {
    type: Number,
    min: [1, 'Quantity must be at least 1']
  },
  unit: {
    type: String,
    trim: true
  },
  // New field for multiple items from cart
  items: {
    type: [requestItemSchema],
    default: []
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  purpose: {
    type: String,
    required: [true, 'Please specify the purpose of the request'],
    trim: true
  },
  requestedByName: {
    type: String,
    trim: true,
    default: ''
  },
  requestedByDesignation: {
    type: String,
    trim: true,
    default: ''
  },
  receivedByName: {
    type: String,
    trim: true,
    default: ''
  },
  receivedByDesignation: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  budgetSource: {
    type: String,
    enum: ['MOOE', 'SSP'],
    default: 'MOOE',
    trim: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  risNumber: {
    type: String,
    trim: true,
    unique: true,
    sparse: true // Allows multiple null values but unique non-null values
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Request', requestSchema);
