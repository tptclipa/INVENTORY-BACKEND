const Request = require('../models/Request');
const Item = require('../models/Item');
const Transaction = require('../models/Transaction');

// @desc    Get all requests (admin sees all, users see only their own)
// @route   GET /api/requests
// @access  Private
exports.getRequests = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    // If user is not admin, only show their requests
    if (req.user.role !== 'admin') {
      query.requestedBy = req.user.id;
    }

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const requests = await Request.find(query)
      .populate('item', 'name sku quantity')
      .populate('items.item', 'name sku quantity')
      .populate('requestedBy', 'username email')
      .populate('reviewedBy', 'username')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single request
// @route   GET /api/requests/:id
// @access  Private
exports.getRequest = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('item', 'name sku quantity')
      .populate('items.item', 'name sku quantity')
      .populate('requestedBy', 'username email')
      .populate('reviewedBy', 'username');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check if user has permission to view this request
    if (req.user.role !== 'admin' && request.requestedBy._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this request'
      });
    }

    res.status(200).json({
      success: true,
      data: request
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create new request
// @route   POST /api/requests
// @access  Private
exports.createRequest = async (req, res) => {
  try {
    const { item, quantity, unit, items, purpose, notes, budgetSource, requestedByName, requestedByDesignation, receivedByName, receivedByDesignation } = req.body;

    // Check if this is a multi-item request (from cart) or single item (legacy/direct)
    if (items && items.length > 0) {
      // Multi-item request from cart
      // Validate all items
      for (const requestItem of items) {
        const itemExists = await Item.findById(requestItem.item);
        
        if (!itemExists) {
          return res.status(404).json({
            success: false,
            message: `Item not found: ${requestItem.item}`
          });
        }

        if (itemExists.quantity < parseInt(requestItem.quantity)) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${itemExists.name}. Available: ${itemExists.quantity}`
          });
        }
      }

      // Create request with multiple items
      const request = await Request.create({
        items,
        purpose,
        notes,
        budgetSource,
        requestedBy: req.user.id,
        requestedByName,
        requestedByDesignation,
        receivedByName,
        receivedByDesignation
      });

      const populatedRequest = await Request.findById(request._id)
        .populate('items.item', 'name sku quantity unit')
        .populate('requestedBy', 'username email');

      res.status(201).json({
        success: true,
        data: populatedRequest
      });

    } else {
      // Single item request (legacy support)
      const itemExists = await Item.findById(item);

      if (!itemExists) {
        return res.status(404).json({
          success: false,
          message: 'Item not found'
        });
      }

      if (itemExists.quantity < parseInt(quantity)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available quantity: ${itemExists.quantity}`
        });
      }

      // Create request
      const request = await Request.create({
        item,
        quantity,
        unit,
        purpose,
        notes,
        budgetSource,
        requestedBy: req.user.id,
        requestedByName,
        requestedByDesignation,
        receivedByName,
        receivedByDesignation
      });

      const populatedRequest = await Request.findById(request._id)
        .populate('item', 'name sku quantity')
        .populate('requestedBy', 'username email');

      res.status(201).json({
        success: true,
        data: populatedRequest
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update request (only for canceling by user)
// @route   PUT /api/requests/:id
// @access  Private
exports.updateRequest = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check if user owns this request
    if (request.requestedBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this request'
      });
    }

    // Only allow updating pending requests
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a request that has been reviewed'
      });
    }

    // Allow updating quantity, purpose, and notes
    const { quantity, purpose, notes } = req.body;

    if (quantity) {
      const item = await Item.findById(request.item);
      if (item.quantity < parseInt(quantity)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available quantity: ${item.quantity}`
        });
      }
      request.quantity = quantity;
    }

    if (purpose) request.purpose = purpose;
    if (notes !== undefined) request.notes = notes;

    await request.save();

    const updatedRequest = await Request.findById(request._id)
      .populate('item', 'name sku quantity')
      .populate('requestedBy', 'username email');

    res.status(200).json({
      success: true,
      data: updatedRequest
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Approve request (admin only)
// @route   PUT /api/requests/:id/approve
// @access  Private/Admin
exports.approveRequest = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request has already been reviewed'
      });
    }

    // Check if item has sufficient stock
    const item = await Item.findById(request.item);
    if (item.quantity < request.quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock to approve this request'
      });
    }

    // Update item quantity
    item.quantity -= request.quantity;
    await item.save();

    // Create transaction record (balanceAfter = stock after this issue; links to request for RIS history)
    await Transaction.create({
      item: request.item,
      type: 'out',
      quantity: request.quantity,
      balanceAfter: item.quantity,
      request: request._id,
      notes: `Request approved - ${request.purpose}`,
      performedBy: req.user.id
    });

    // Update request status
    request.status = 'approved';
    request.reviewedBy = req.user.id;
    request.reviewedAt = Date.now();
    await request.save();

    const updatedRequest = await Request.findById(request._id)
      .populate('item', 'name sku quantity')
      .populate('requestedBy', 'username email')
      .populate('reviewedBy', 'username');

    res.status(200).json({
      success: true,
      data: updatedRequest
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reject request (admin only)
// @route   PUT /api/requests/:id/reject
// @access  Private/Admin
exports.rejectRequest = async (req, res) => {
  try {
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a rejection reason'
      });
    }

    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request has already been reviewed'
      });
    }

    request.status = 'rejected';
    request.reviewedBy = req.user.id;
    request.reviewedAt = Date.now();
    request.rejectionReason = rejectionReason;
    await request.save();

    const updatedRequest = await Request.findById(request._id)
      .populate('item', 'name sku quantity')
      .populate('requestedBy', 'username email')
      .populate('reviewedBy', 'username');

    res.status(200).json({
      success: true,
      data: updatedRequest
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Approve individual item in multi-item request
// @route   PUT /api/requests/:id/items/:itemId/approve
// @access  Private/Admin
exports.approveRequestItem = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Try to find by _id first, then by index
    let itemIndex = request.items.findIndex(
      item => item._id && item._id.toString() === req.params.itemId
    );
    
    // If not found by ID, try to use itemId as index
    if (itemIndex === -1) {
      const idx = parseInt(req.params.itemId);
      if (!isNaN(idx) && idx >= 0 && idx < request.items.length) {
        itemIndex = idx;
      }
    }

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in request'
      });
    }

    const requestItem = request.items[itemIndex];
    
    // Check if item has sufficient stock
    const item = await Item.findById(requestItem.item);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in inventory'
      });
    }
    
    if (item.quantity < requestItem.quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock to approve this item. Available: ${item.quantity}`
      });
    }

    // Deduct from inventory
    item.quantity -= requestItem.quantity;
    await item.save();

    // Create transaction record (balanceAfter = stock after this issue; links to request for RIS history)
    await Transaction.create({
      item: requestItem.item,
      type: 'out',
      quantity: requestItem.quantity,
      balanceAfter: item.quantity,
      request: request._id,
      notes: `Request approved - ${request.purpose}`,
      performedBy: req.user.id
    });

    // Update item status
    request.items[itemIndex].status = 'approved';
    await request.save();

    // Check if all items have been reviewed
    const allReviewed = request.items.every(item => item.status !== 'pending');
    const hasApproved = request.items.some(item => item.status === 'approved');
    
    if (allReviewed) {
      request.status = hasApproved ? 'approved' : 'rejected';
      request.reviewedBy = req.user.id;
      request.reviewedAt = Date.now();
      await request.save();
    }

    const updatedRequest = await Request.findById(request._id)
      .populate('items.item', 'name sku quantity')
      .populate('requestedBy', 'username email');

    res.status(200).json({
      success: true,
      data: updatedRequest
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reject individual item in multi-item request
// @route   PUT /api/requests/:id/items/:itemId/reject
// @access  Private/Admin
exports.rejectRequestItem = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Try to find by _id first, then by index
    let itemIndex = request.items.findIndex(
      item => item._id && item._id.toString() === req.params.itemId
    );
    
    // If not found by ID, try to use itemId as index
    if (itemIndex === -1) {
      const idx = parseInt(req.params.itemId);
      if (!isNaN(idx) && idx >= 0 && idx < request.items.length) {
        itemIndex = idx;
      }
    }

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in request'
      });
    }

    // Update item status
    request.items[itemIndex].status = 'rejected';
    request.items[itemIndex].rejectionReason = rejectionReason || 'No reason provided';
    await request.save();

    // Check if all items have been reviewed
    const allReviewed = request.items.every(item => item.status !== 'pending');
    const hasApproved = request.items.some(item => item.status === 'approved');
    
    if (allReviewed) {
      request.status = hasApproved ? 'approved' : 'rejected';
      request.reviewedBy = req.user.id;
      request.reviewedAt = Date.now();
      await request.save();
    }

    const updatedRequest = await Request.findById(request._id)
      .populate('items.item', 'name sku quantity')
      .populate('requestedBy', 'username email');

    res.status(200).json({
      success: true,
      data: updatedRequest
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete request (only pending requests by owner)
// @route   DELETE /api/requests/:id
// @access  Private
exports.deleteRequest = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check if user owns this request or is admin
    if (request.requestedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this request'
      });
    }

    // Only allow deleting pending requests
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a request that has been reviewed'
      });
    }

    await request.deleteOne();

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
