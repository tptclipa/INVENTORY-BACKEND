const express = require('express');
const router = express.Router();
const {
  getActivityLogs,
  getActivityStats,
  cleanupExpiredLogs
} = require('../controllers/activityLogController');
const { protect, authorize } = require('../middleware/auth');

// Get activity logs - users see their own, admins see all
router.get('/', protect, getActivityLogs);

// Get activity statistics - admin only
router.get('/stats', protect, authorize('admin'), getActivityStats);

// Manual cleanup of expired logs - admin only
router.delete('/cleanup', protect, authorize('admin'), cleanupExpiredLogs);

module.exports = router;
