const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'create_item',
      'update_item',
      'delete_item',
      'create_category',
      'update_category',
      'delete_category',
      'create_transaction',
      'create_request',
      'update_request',
      'delete_request',
      'approve_request',
      'reject_request',
      'generate_report',
      'export_data',
      'other'
    ]
  },
  resourceType: {
    type: String,
    enum: ['item', 'category', 'transaction', 'request', 'user', 'report', 'system', 'other']
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  details: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: String,
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  }
});

// Create TTL index to automatically delete expired documents
activityLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to set expiration date (3 weeks from creation)
activityLogSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    const threeWeeks = 21 * 24 * 60 * 60 * 1000; // 3 weeks in milliseconds
    this.expiresAt = new Date(Date.now() + threeWeeks);
  }
  next();
});

// Static method to create activity log
activityLogSchema.statics.createLog = async function(logData) {
  try {
    // Set expiresAt if not provided (3 weeks from now)
    if (!logData.expiresAt) {
      const threeWeeks = 21 * 24 * 60 * 60 * 1000; // 3 weeks in milliseconds
      logData.expiresAt = new Date(Date.now() + threeWeeks);
    }
    
    console.log('Creating activity log with data:', JSON.stringify(logData, null, 2));
    const log = await this.create(logData);
    console.log('Activity log created successfully:', log._id);
    return log;
  } catch (error) {
    console.error('Error creating activity log - Details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      logData: logData
    });
    // Throw error so caller can handle it
    throw error;
  }
};

module.exports = mongoose.model('ActivityLog', activityLogSchema);
