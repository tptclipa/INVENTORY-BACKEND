const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');
const Item = require('../models/Item');
const Transaction = require('../models/Transaction');
const Request = require('../models/Request');

// Helper function to load template
const loadTemplate = (templateName) => {
  const templatePath = path.join(__dirname, '../templates', `${templateName}.docx`);
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template ${templateName} not found`);
  }
  
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  return new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });
};

// Helper function to format date
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// @desc    Generate inventory report
// @route   POST /api/documents/inventory-report
// @access  Private
exports.generateInventoryReport = async (req, res) => {
  try {
    const { category, lowStockOnly } = req.body;
    
    // Build query
    let query = {};
    if (category) {
      query.category = category;
    }
    if (lowStockOnly) {
      query.$expr = { $lte: ['$quantity', '$minStockLevel'] };
    }
    
    // Fetch items
    const items = await Item.find(query)
      .populate('category', 'name')
      .populate('createdBy', 'username')
      .sort('name');
    
    // Calculate totals
    const totalItems = items.length;
    const lowStockItems = items.filter(item => item.quantity <= item.minStockLevel).length;
    const totalValue = items.reduce((sum, item) => sum + item.quantity, 0);
    
    // Prepare data for template
    const data = {
      reportDate: formatDate(new Date()),
      generatedBy: req.user.username,
      totalItems,
      lowStockItems,
      totalValue,
      items: items.map(item => ({
        name: item.name,
        sku: item.sku || 'N/A',
        category: item.category?.name || 'Uncategorized',
        quantity: item.quantity,
        unit: item.unit,
        minStockLevel: item.minStockLevel,
        status: item.quantity <= item.minStockLevel ? 'Low Stock' : 'In Stock',
        description: item.description || ''
      }))
    };
    
    // Load and render template
    const doc = loadTemplate('inventory-report');
    doc.render(data);
    
    // Generate buffer
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });
    
    // Set headers and send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=inventory-report-${Date.now()}.docx`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating inventory report:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Generate low stock alert
// @route   POST /api/documents/low-stock-alert
// @access  Private
exports.generateLowStockAlert = async (req, res) => {
  try {
    // Fetch low stock items
    const items = await Item.find({
      $expr: { $lte: ['$quantity', '$minStockLevel'] }
    })
      .populate('category', 'name')
      .sort('quantity');
    
    // Prepare data for template
    const data = {
      reportDate: formatDate(new Date()),
      generatedBy: req.user.username,
      alertCount: items.length,
      criticalItems: items.filter(item => item.quantity === 0).length,
      items: items.map(item => ({
        name: item.name,
        sku: item.sku || 'N/A',
        category: item.category?.name || 'Uncategorized',
        currentQuantity: item.quantity,
        minStockLevel: item.minStockLevel,
        unit: item.unit,
        shortage: Math.max(0, item.minStockLevel - item.quantity),
        status: item.quantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK'
      }))
    };
    
    // Load and render template
    const doc = loadTemplate('low-stock-alert');
    doc.render(data);
    
    // Generate buffer
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });
    
    // Set headers and send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=low-stock-alert-${Date.now()}.docx`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating low stock alert:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Generate transaction report
// @route   POST /api/documents/transaction-report
// @access  Private
exports.generateTransactionReport = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.body;
    
    // Build query
    let query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (type) {
      query.type = type;
    }
    
    // Fetch transactions
    const transactions = await Transaction.find(query)
      .populate('item', 'name sku')
      .populate('user', 'username')
      .sort('-createdAt');
    
    // Calculate statistics
    const stockIns = transactions.filter(t => t.type === 'stock-in');
    const stockOuts = transactions.filter(t => t.type === 'stock-out');
    const adjustments = transactions.filter(t => t.type === 'adjustment');
    
    const totalStockIn = stockIns.reduce((sum, t) => sum + t.quantity, 0);
    const totalStockOut = stockOuts.reduce((sum, t) => sum + t.quantity, 0);
    
    // Prepare data for template
    const data = {
      reportDate: formatDate(new Date()),
      generatedBy: req.user.username,
      startDate: startDate ? formatDate(startDate) : 'All time',
      endDate: endDate ? formatDate(endDate) : 'Present',
      totalTransactions: transactions.length,
      totalStockIn,
      totalStockOut,
      totalAdjustments: adjustments.length,
      transactions: transactions.map(t => ({
        date: formatDate(t.createdAt),
        item: t.item?.name || 'Unknown',
        sku: t.item?.sku || 'N/A',
        type: t.type.toUpperCase().replace('-', ' '),
        quantity: t.quantity,
        reason: t.reason || '',
        user: t.user?.username || 'System'
      }))
    };
    
    // Load and render template
    const doc = loadTemplate('transaction-report');
    doc.render(data);
    
    // Generate buffer
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });
    
    // Set headers and send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=transaction-report-${Date.now()}.docx`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating transaction report:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Generate item label
// @route   POST /api/documents/item-label/:id
// @access  Private
exports.generateItemLabel = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('category', 'name');
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }
    
    // Prepare data for template
    const data = {
      name: item.name,
      sku: item.sku || 'N/A',
      category: item.category?.name || 'Uncategorized',
      quantity: item.quantity,
      unit: item.unit,
      description: item.description || '',
      dateGenerated: formatDate(new Date())
    };
    
    // Load and render template
    const doc = loadTemplate('item-label');
    doc.render(data);
    
    // Generate buffer
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });
    
    // Set headers and send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=label-${item.sku || item._id}-${Date.now()}.docx`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating item label:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
