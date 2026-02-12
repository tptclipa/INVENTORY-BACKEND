const Transaction = require('../models/Transaction');
const Item = require('../models/Item');

// @desc    Get all transactions
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const { itemId, type, startDate, endDate } = req.query;
    let query = {};

    // If user is not admin, only show their own transactions
    if (req.user.role !== 'admin') {
      query.performedBy = req.user.id;
    }

    // Filter by item
    if (itemId) {
      query.item = itemId;
    }

    // Filter by type
    if (type) {
      query.type = type;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const transactions = await Transaction.find(query)
      .populate('item', 'name sku')
      .populate('performedBy', 'username')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get transactions for a specific item
// @route   GET /api/transactions/item/:itemId
// @access  Private
exports.getItemTransactions = async (req, res) => {
  try {
    let query = { item: req.params.itemId };

    // If user is not admin, only show their own transactions
    if (req.user.role !== 'admin') {
      query.performedBy = req.user.id;
    }

    const transactions = await Transaction.find(query)
      .populate('performedBy', 'username')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create new transaction (stock in/out)
// @route   POST /api/transactions
// @access  Private
exports.createTransaction = async (req, res) => {
  try {
    const { item, type, quantity, notes } = req.body;

    // Check if item exists
    const itemExists = await Item.findById(item);

    if (!itemExists) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Update item quantity based on transaction type
    if (type === 'in') {
      itemExists.quantity += parseInt(quantity);
    } else if (type === 'out') {
      if (itemExists.quantity < parseInt(quantity)) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock quantity'
        });
      }
      itemExists.quantity -= parseInt(quantity);
    }

    await itemExists.save();

    // Create transaction (balanceAfter = stock after this transaction for history)
    const transaction = await Transaction.create({
      item,
      type,
      quantity,
      balanceAfter: itemExists.quantity,
      notes,
      performedBy: req.user.id
    });

    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate('item', 'name sku')
      .populate('performedBy', 'username');

    res.status(201).json({
      success: true,
      data: populatedTransaction
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
