const ActivityLog = require('../models/ActivityLog');

// Helper function to extract action from route and method
const getActionFromRoute = (method, path) => {
  const pathLower = path.toLowerCase();
  
  if (pathLower.includes('login')) return 'login';
  if (pathLower.includes('logout')) return 'logout';
  if (pathLower.includes('approve')) return 'approve_request';
  if (pathLower.includes('reject')) return 'reject_request';
  if (pathLower.includes('report') || pathLower.includes('generate')) return 'generate_report';
  if (pathLower.includes('export')) return 'export_data';
  
  // Map HTTP methods to actions
  if (method === 'POST') {
    if (pathLower.includes('item')) return 'create_item';
    if (pathLower.includes('categor')) return 'create_category';
    if (pathLower.includes('transaction')) return 'create_transaction';
    if (pathLower.includes('request')) return 'create_request';
  }
  
  if (method === 'PUT' || method === 'PATCH') {
    if (pathLower.includes('item')) return 'update_item';
    if (pathLower.includes('categor')) return 'update_category';
    if (pathLower.includes('request')) return 'update_request';
  }
  
  if (method === 'DELETE') {
    if (pathLower.includes('item')) return 'delete_item';
    if (pathLower.includes('categor')) return 'delete_category';
    if (pathLower.includes('request')) return 'delete_request';
  }
  
  return 'other';
};

// Helper function to get resource type from path
const getResourceType = (path) => {
  const pathLower = path.toLowerCase();
  
  if (pathLower.includes('item')) return 'item';
  if (pathLower.includes('categor')) return 'category';
  if (pathLower.includes('transaction')) return 'transaction';
  if (pathLower.includes('request')) return 'request';
  if (pathLower.includes('report') || pathLower.includes('export')) return 'report';
  if (pathLower.includes('auth') || pathLower.includes('login')) return 'system';
  
  return 'other';
};

// Middleware to log activities
const logActivity = (options = {}) => {
  return async (req, res, next) => {
    // Store original res.json to intercept successful responses
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Don't log GET requests or activity log operations
        if (req.method !== 'GET' && !req.path.includes('activity-log')) {
          const action = options.action || getActionFromRoute(req.method, req.path);
          const resourceType = options.resourceType || getResourceType(req.path);
          
          // Extract resource ID from response or params
          const resourceId = data?.data?._id || req.params?.id || null;
          
          // Build details string
          let details = options.details || `${req.method} ${req.path}`;
          if (data?.data?.name) {
            details += ` - ${data.data.name}`;
          } else if (data?.data?.username) {
            details += ` - ${data.data.username}`;
          }
          
          // Create activity log asynchronously (don't wait for it)
          if (req.user) {
            ActivityLog.createLog({
              user: req.user.id,
              action,
              resourceType,
              resourceId,
              details,
              metadata: {
                method: req.method,
                path: req.path,
                params: req.params,
                body: sanitizeBody(req.body)
              },
              ipAddress: req.ip || req.connection.remoteAddress,
              userAgent: req.get('user-agent')
            }).catch(err => {
              console.error('Failed to log activity:', err);
            });
          }
        }
      }
      
      return originalJson(data);
    };
    
    next();
  };
};

// Helper to sanitize sensitive data from request body
const sanitizeBody = (body) => {
  if (!body) return {};
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.secret;
  
  return sanitized;
};

module.exports = { logActivity };
