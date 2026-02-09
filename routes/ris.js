const express = require('express');
const router = express.Router();
const {
  generateRIS,
  generateCustomRIS,
  generateRISBatch,
  previewTemplate
} = require('../controllers/risController');
const { protect, authorize } = require('../middleware/auth');

// Preview template structure (for setup/debugging)
router.get('/preview-template', protect, authorize('admin'), previewTemplate);

// Generate RIS from approved request (any authenticated user can download their approved RIS)
router.post('/generate/:requestId', protect, generateRIS);

// Generate batch RIS (2 requests in one file)
router.post('/generate-batch', protect, generateRISBatch);

// Generate custom RIS manually
router.post('/generate-custom', protect, authorize('admin'), generateCustomRIS);

module.exports = router;
