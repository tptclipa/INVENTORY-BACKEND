const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { protect, authorize } = require('../middleware/auth');
const { generateVerificationCode, sendPasswordChangeVerificationEmail } = require('../services/emailService');

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

// @desc    Create new user
// @route   POST /api/users
// @access  Private (Admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this username or email already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      username,
      email,
      password,
      role: role || 'user'
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin only)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if username or email is taken by another user
    if (username !== user.username || email !== user.email) {
      const existingUser = await User.findOne({
        _id: { $ne: req.params.id },
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username or email already taken by another user'
        });
      }
    }

    // Update fields
    user.name = name || user.name;
    user.username = username || user.username;
    user.email = email || user.email;
    user.role = role || user.role;
    
    // Password should only be changed via dedicated endpoint
    // Don't update password in general user update

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Send verification code to email for password change (logged-in user)
// @route   POST /api/users/me/password/send-code
// @access  Private
router.post('/me/password/send-code', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('email name +passwordResetCode +passwordResetExpiry');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const code = generateVerificationCode();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.passwordResetCode = code;
    user.passwordResetExpiry = expiry;
    await user.save();

    try {
      await sendPasswordChangeVerificationEmail(user.email, user.name, code);
    } catch (emailError) {
      console.error('Failed to send password change verification email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Change own password (for logged-in users) — requires email verification code
// @route   PUT /api/users/me/password
// @access  Private
router.put('/me/password', protect, async (req, res) => {
  try {
    const { code, password } = req.body;

    if (!code || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide verification code and new password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.user.id)
      .select('+password +passwordResetCode +passwordResetExpiry');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.passwordResetCode !== code || !user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    user.password = password;
    user.passwordResetCode = undefined;
    user.passwordResetExpiry = undefined;
    await user.save();

    try {
      await ActivityLog.createLog({
        user: user._id,
        action: 'other',
        resourceType: 'user',
        details: `${user.name} changed their password`,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      });
    } catch (logError) {
      console.error('Failed to create password change activity log:', logError);
    }

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Change user password (Admin only)
// @route   PUT /api/users/:id/password
// @access  Private (Admin only)
router.put('/:id/password', protect, authorize('admin'), async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.password = password;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
