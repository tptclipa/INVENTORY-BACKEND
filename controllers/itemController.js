const Item = require('../models/Item');
const Transaction = require('../models/Transaction');

// @desc    Get all items
// @route   GET /api/items
// @access  Private
exports.getItems = async (req, res) => {
  try {
    const { search, category, lowStock, sort } = req.query;
    let query = {};

    // Search by name, SKU, or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter low stock items
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$quantity', '$minStockLevel'] };
    }

    let items = Item.find(query).populate('category', 'name').populate('createdBy', 'username');

    // Sort
    if (sort) {
      const sortBy = sort.split(',').join(' ');
      items = items.sort(sortBy);
    } else {
      items = items.sort('-createdAt');
    }

    const results = await items;

    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single item
// @route   GET /api/items/:id
// @access  Private
exports.getItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('category', 'name')
      .populate('createdBy', 'username');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create new item
// @route   POST /api/items
// @access  Private
exports.createItem = async (req, res) => {
  try {
    // Add user to req.body
    req.body.createdBy = req.user.id;

    const item = await Item.create(req.body);

    // Create initial transaction record if item has initial quantity
    if (item.quantity > 0) {
      await Transaction.create({
        item: item._id,
        type: 'in',
        quantity: item.quantity,
        balanceAfter: item.quantity,
        notes: 'Initial stock - Item created',
        performedBy: req.user.id
      });
    }

    res.status(201).json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update item
// @route   PUT /api/items/:id
// @access  Private
exports.updateItem = async (req, res) => {
  try {
    // Get the original item first to compare quantity changes
    const originalItem = await Item.findById(req.params.id);

    if (!originalItem) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    const oldQuantity = originalItem.quantity;
    const newQuantity = req.body.quantity;

    // Update the item
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate('category', 'name');

    // Create transaction record if quantity changed
    if (newQuantity !== undefined && oldQuantity !== newQuantity) {
      const quantityDiff = newQuantity - oldQuantity;
      
      if (quantityDiff !== 0) {
        const transactionType = quantityDiff > 0 ? 'in' : 'out';
        const transactionQuantity = Math.abs(quantityDiff);
        
        await Transaction.create({
          item: req.params.id,
          type: transactionType,
          quantity: transactionQuantity,
          balanceAfter: newQuantity,
          notes: transactionType === 'in' 
            ? `Restocking - Item quantity updated from ${oldQuantity} to ${newQuantity}`
            : `Stock adjustment - Item quantity updated from ${oldQuantity} to ${newQuantity}`,
          performedBy: req.user.id
        });
      }
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete item
// @route   DELETE /api/items/:id
// @access  Private (Admin only)
exports.deleteItem = async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get low stock items
// @route   GET /api/items/low-stock
// @access  Private
exports.getLowStockItems = async (req, res) => {
  try {
    const items = await Item.find({
      $expr: { $lte: ['$quantity', '$minStockLevel'] }
    })
      .populate('category', 'name')
      .sort('quantity');

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
