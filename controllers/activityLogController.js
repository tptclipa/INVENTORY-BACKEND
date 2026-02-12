const ActivityLog = require('../models/ActivityLog');

// @desc    Get activity logs
// @route   GET /api/activity-logs
// @access  Private
exports.getActivityLogs = async (req, res) => {
  try {
    const { action, resourceType, startDate, endDate, userId } = req.query;
    let query = {};

    // If user is not admin, only show their own activity logs
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    } else if (userId) {
      // Admin can filter by specific user
      query.user = userId;
    }

    // Filter by action
    if (action) {
      query.action = action;
    }

    // Filter by resource type
    if (resourceType) {
      query.resourceType = resourceType;
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

    const logs = await ActivityLog.find(query)
      .populate('user', 'username name email')
      .sort('-createdAt')
      .limit(500); // Limit to prevent performance issues

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get activity log statistics
// @route   GET /api/activity-logs/stats
// @access  Private (Admin only)
exports.getActivityStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = {};

    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    }

    // Get action counts
    const actionStats = await ActivityLog.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get user activity counts
    const userStats = await ActivityLog.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          username: '$userInfo.username',
          name: '$userInfo.name',
          count: 1
        }
      }
    ]);

    // Get total logs
    const totalLogs = await ActivityLog.countDocuments(dateFilter);

    // Get logs expiring soon (within 3 days)
    const expiringLogs = await ActivityLog.countDocuments({
      expiresAt: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      }
    });

    res.status(200).json({
      success: true,
      data: {
        totalLogs,
        expiringLogs,
        actionStats,
        userStats
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete expired logs manually (usually handled by MongoDB TTL)
// @route   DELETE /api/activity-logs/cleanup
// @access  Private (Admin only)
exports.cleanupExpiredLogs = async (req, res) => {
  try {
    const result = await ActivityLog.deleteMany({
      expiresAt: { $lt: new Date() }
    });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} expired activity logs`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Helper function to create activity log (can be used in other controllers)
exports.createActivityLog = async (logData) => {
  try {
    return await ActivityLog.createLog(logData);
  } catch (error) {
    console.error('Error creating activity log:', error);
    return null;
  }
};
