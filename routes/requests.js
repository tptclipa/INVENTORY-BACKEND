const express = require('express');
const router = express.Router();
const {
  getRequests,
  getRequest,
  createRequest,
  updateRequest,
  approveRequest,
  rejectRequest,
  deleteRequest,
  approveRequestItem,
  rejectRequestItem
} = require('../controllers/requestController');
const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(protect, getRequests)
  .post(protect, createRequest);

router.route('/:id')
  .get(protect, getRequest)
  .put(protect, updateRequest)
  .delete(protect, deleteRequest);

router.put('/:id/approve', protect, authorize('admin'), approveRequest);
router.put('/:id/reject', protect, authorize('admin'), rejectRequest);

// Individual item approval/rejection in multi-item requests
router.put('/:id/items/:itemId/approve', protect, authorize('admin'), approveRequestItem);
router.put('/:id/items/:itemId/reject', protect, authorize('admin'), rejectRequestItem);

module.exports = router;
