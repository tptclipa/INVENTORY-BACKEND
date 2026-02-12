const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
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

    // Create token
    const token = generateToken(user._id);

    // Log registration activity
    try {
      await ActivityLog.createLog({
        user: user._id,
        action: 'login',
        resourceType: 'system',
        details: `New user ${user.username} registered and logged in`,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      });
      console.log(`Registration activity log created for user: ${user.username}`);
    } catch (logError) {
      console.error('Failed to create registration activity log:', logError);
    }

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        token
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate username & password
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a username and password'
      });
    }

    // Check for user
    const user = await User.findOne({ username }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Create token
    const token = generateToken(user._id);

    // Log login activity (await to catch errors)
    try {
      await ActivityLog.createLog({
        user: user._id,
        action: 'login',
        resourceType: 'system',
        details: `User ${user.username} logged in`,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      });
      console.log(`Activity log created for user: ${user.username}`);
    } catch (logError) {
      console.error('Failed to create activity log:', logError);
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        token
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Admin login with password only
// @route   POST /api/auth/admin-login
// @access  Public
exports.adminLogin = async (req, res) => {
  try {
    const { password } = req.body;

    // Validate password
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a password'
      });
    }

    // Find the first admin user and check password
    const adminUser = await User.findOne({ role: 'admin' }).select('+password');

    if (!adminUser) {
      return res.status(401).json({
        success: false,
        message: 'No admin account found'
      });
    }

    // Check if password matches
    const isMatch = await adminUser.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin password'
      });
    }

    // Create token
    const token = generateToken(adminUser._id);

    // Log admin login activity (await to catch errors)
    try {
      await ActivityLog.createLog({
        user: adminUser._id,
        action: 'login',
        resourceType: 'system',
        details: `Admin ${adminUser.username} logged in`,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      });
      console.log(`Activity log created for admin: ${adminUser.username}`);
    } catch (logError) {
      console.error('Failed to create admin activity log:', logError);
    }

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: adminUser._id,
        name: adminUser.name,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    // Log logout activity (await to catch errors)
    try {
      await ActivityLog.createLog({
        user: req.user.id,
        action: 'logout',
        resourceType: 'system',
        details: `User ${req.user.username} logged out`,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      });
      console.log(`Logout activity log created for user: ${req.user.username}`);
    } catch (logError) {
      console.error('Failed to create logout activity log:', logError);
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
