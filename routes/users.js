const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin only)
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    console.log('Fetching all users for admin:', req.user.username);
    const users = await User.find()
      .select('_id username name email role createdAt')
      .sort('username');

    console.log(`Found ${users.length} users`);
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
