const ExcelJS = require('exceljs');
const Item = require('../models/Item');
const Transaction = require('../models/Transaction');
const Request = require('../models/Request');

// Helper function to format date
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Helper function to format datetime
const formatDateTime = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Helper to style header row
const styleHeaderRow = (row) => {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
};

// @desc    Export inventory to Excel
// @route   POST /api/excel/inventory-report
// @access  Private
exports.exportInventoryReport = async (req, res) => {
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
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = req.user.username;
    workbook.created = new Date();
    
    // Add worksheet
    const worksheet = workbook.addWorksheet('Inventory Report', {
      properties: { tabColor: { argb: 'FF4472C4' } }
    });
    
    // Add title
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'INVENTORY REPORT';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF4472C4' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;
    
    // Add metadata
    worksheet.mergeCells('A2:B2');
    worksheet.getCell('A2').value = `Generated: ${formatDate(new Date())}`;
    worksheet.getCell('A2').font = { italic: true };
    
    worksheet.mergeCells('A3:B3');
    worksheet.getCell('A3').value = `By: ${req.user.username}`;
    worksheet.getCell('A3').font = { italic: true };
    
    // Add summary
    const lowStockCount = items.filter(item => item.quantity <= item.minStockLevel).length;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    
    worksheet.mergeCells('D2:E2');
    worksheet.getCell('D2').value = `Total Items: ${items.length}`;
    worksheet.getCell('D2').font = { bold: true };
    
    worksheet.mergeCells('D3:E3');
    worksheet.getCell('D3').value = `Low Stock Items: ${lowStockCount}`;
    worksheet.getCell('D3').font = { bold: true, color: { argb: lowStockCount > 0 ? 'FFFF0000' : 'FF000000' } };
    
    worksheet.mergeCells('F2:G2');
    worksheet.getCell('F2').value = `Total Quantity: ${totalQuantity}`;
    worksheet.getCell('F2').font = { bold: true };
    
    // Add empty row
    worksheet.addRow([]);
    
    // Add headers
    const headerRow = worksheet.addRow([
      'Item Name',
      'SKU / Stock No.',
      'Category',
      'Quantity',
      'Unit',
      'Min Stock Level',
      'Status',
      'Description'
    ]);
    styleHeaderRow(headerRow);
    
    // Add data rows
    items.forEach(item => {
      const isLowStock = item.quantity <= item.minStockLevel;
      const row = worksheet.addRow([
        item.name,
        item.sku || 'N/A',
        item.category?.name || 'Uncategorized',
        item.quantity,
        item.unit || 'pcs',
        item.minStockLevel,
        isLowStock ? 'LOW STOCK' : 'IN STOCK',
        item.description || ''
      ]);
      
      // Highlight low stock rows
      if (isLowStock) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF3CD' }
        };
      }
      
      // Format quantity cells
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      
      // Status cell formatting
      const statusCell = row.getCell(7);
      statusCell.font = { bold: true, color: { argb: isLowStock ? 'FFDC3545' : 'FF28A745' } };
      statusCell.alignment = { horizontal: 'center' };
    });
    
    // Auto-fit columns
    worksheet.columns = [
      { key: 'name', width: 25 },
      { key: 'sku', width: 15 },
      { key: 'category', width: 20 },
      { key: 'quantity', width: 12 },
      { key: 'unit', width: 10 },
      { key: 'minStock', width: 15 },
      { key: 'status', width: 15 },
      { key: 'description', width: 35 }
    ];
    
    // Add borders to all cells with data
    const lastRow = worksheet.lastRow.number;
    for (let i = 5; i <= lastRow; i++) {
      const row = worksheet.getRow(i);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
    
    // Freeze header row
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 5 }
    ];
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=inventory-report-${Date.now()}.xlsx`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error exporting inventory:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Export low stock items to Excel
// @route   POST /api/excel/low-stock-alert
// @access  Private
exports.exportLowStockAlert = async (req, res) => {
  try {
    // Fetch low stock items
    const items = await Item.find({
      $expr: { $lte: ['$quantity', '$minStockLevel'] }
    })
      .populate('category', 'name')
      .sort('quantity');
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = req.user.username;
    workbook.created = new Date();
    
    // Add worksheet
    const worksheet = workbook.addWorksheet('Low Stock Alert', {
      properties: { tabColor: { argb: 'FFDC3545' } }
    });
    
    // Add title
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = '⚠ LOW STOCK ALERT';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FFDC3545' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;
    
    // Add metadata
    worksheet.mergeCells('A2:B2');
    worksheet.getCell('A2').value = `Alert Date: ${formatDate(new Date())}`;
    worksheet.getCell('A2').font = { italic: true };
    
    worksheet.mergeCells('A3:B3');
    worksheet.getCell('A3').value = `Generated By: ${req.user.username}`;
    worksheet.getCell('A3').font = { italic: true };
    
    // Add summary
    const criticalCount = items.filter(item => item.quantity === 0).length;
    
    worksheet.mergeCells('D2:E2');
    worksheet.getCell('D2').value = `Total Low Stock Items: ${items.length}`;
    worksheet.getCell('D2').font = { bold: true, color: { argb: 'FFDC3545' } };
    
    worksheet.mergeCells('D3:E3');
    worksheet.getCell('D3').value = `Critical (Out of Stock): ${criticalCount}`;
    worksheet.getCell('D3').font = { bold: true, color: { argb: 'FFDC3545' } };
    
    // Add empty row
    worksheet.addRow([]);
    
    // Add headers
    const headerRow = worksheet.addRow([
      'Item Name',
      'SKU',
      'Category',
      'Current Qty',
      'Min Level',
      'Shortage',
      'Status'
    ]);
    styleHeaderRow(headerRow);
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDC3545' }
    };
    
    // Add data rows
    items.forEach(item => {
      const shortage = Math.max(0, item.minStockLevel - item.quantity);
      const isCritical = item.quantity === 0;
      
      const row = worksheet.addRow([
        item.name,
        item.sku || 'N/A',
        item.category?.name || 'Uncategorized',
        item.quantity,
        item.minStockLevel,
        shortage,
        isCritical ? 'OUT OF STOCK' : 'LOW STOCK'
      ]);
      
      // Highlight critical items
      if (isCritical) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE5E5' }
        };
        row.font = { color: { argb: 'FFDC3545' } };
      }
      
      // Center align numbers
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      
      // Status cell
      const statusCell = row.getCell(7);
      statusCell.font = { bold: true, color: { argb: 'FFDC3545' } };
      statusCell.alignment = { horizontal: 'center' };
    });
    
    // Set column widths
    worksheet.columns = [
      { width: 25 },
      { width: 15 },
      { width: 20 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 18 }
    ];
    
    // Add borders
    const lastRow = worksheet.lastRow.number;
    for (let i = 5; i <= lastRow; i++) {
      const row = worksheet.getRow(i);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
    
    // Freeze header
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 5 }
    ];
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=low-stock-alert-${Date.now()}.xlsx`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error exporting low stock alert:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Export transactions to Excel
// @route   POST /api/excel/transaction-report
// @access  Private
exports.exportTransactionReport = async (req, res) => {
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
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = req.user.username;
    workbook.created = new Date();
    
    // Add worksheet
    const worksheet = workbook.addWorksheet('Transaction Report', {
      properties: { tabColor: { argb: 'FF28A745' } }
    });
    
    // Add title
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'TRANSACTION REPORT';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF28A745' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;
    
    // Add metadata
    worksheet.mergeCells('A2:B2');
    worksheet.getCell('A2').value = `Report Date: ${formatDate(new Date())}`;
    worksheet.getCell('A2').font = { italic: true };
    
    worksheet.mergeCells('A3:B3');
    worksheet.getCell('A3').value = `Generated By: ${req.user.username}`;
    worksheet.getCell('A3').font = { italic: true };
    
    worksheet.mergeCells('A4:B4');
    worksheet.getCell('A4').value = `Period: ${startDate ? formatDate(startDate) : 'All time'} to ${endDate ? formatDate(endDate) : 'Present'}`;
    worksheet.getCell('A4').font = { italic: true };
    
    // Add summary
    worksheet.mergeCells('D2:E2');
    worksheet.getCell('D2').value = `Total Transactions: ${transactions.length}`;
    worksheet.getCell('D2').font = { bold: true };
    
    worksheet.mergeCells('D3:E3');
    worksheet.getCell('D3').value = `Stock In: ${totalStockIn} units`;
    worksheet.getCell('D3').font = { bold: true, color: { argb: 'FF28A745' } };
    
    worksheet.mergeCells('D4:E4');
    worksheet.getCell('D4').value = `Stock Out: ${totalStockOut} units`;
    worksheet.getCell('D4').font = { bold: true, color: { argb: 'FFDC3545' } };
    
    worksheet.mergeCells('F3:G3');
    worksheet.getCell('F3').value = `Adjustments: ${adjustments.length}`;
    worksheet.getCell('F3').font = { bold: true };
    
    // Add empty row
    worksheet.addRow([]);
    
    // Add headers
    const headerRow = worksheet.addRow([
      'Date & Time',
      'Item Name',
      'SKU',
      'Type',
      'Quantity',
      'Reason/Notes',
      'Performed By'
    ]);
    styleHeaderRow(headerRow);
    
    // Add data rows
    transactions.forEach(transaction => {
      const isStockIn = transaction.type === 'stock-in';
      const isStockOut = transaction.type === 'stock-out';
      
      const row = worksheet.addRow([
        formatDateTime(transaction.createdAt),
        transaction.item?.name || 'Unknown',
        transaction.item?.sku || 'N/A',
        transaction.type.toUpperCase().replace('-', ' '),
        transaction.quantity,
        transaction.reason || '',
        transaction.user?.username || 'System'
      ]);
      
      // Type cell color
      const typeCell = row.getCell(4);
      if (isStockIn) {
        typeCell.font = { bold: true, color: { argb: 'FF28A745' } };
      } else if (isStockOut) {
        typeCell.font = { bold: true, color: { argb: 'FFDC3545' } };
      }
      typeCell.alignment = { horizontal: 'center' };
      
      // Quantity cell
      row.getCell(5).alignment = { horizontal: 'center' };
    });
    
    // Set column widths
    worksheet.columns = [
      { width: 20 },
      { width: 25 },
      { width: 15 },
      { width: 15 },
      { width: 12 },
      { width: 30 },
      { width: 18 }
    ];
    
    // Add borders
    const lastRow = worksheet.lastRow.number;
    for (let i = 6; i <= lastRow; i++) {
      const row = worksheet.getRow(i);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
    
    // Freeze header
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 6 }
    ];
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=transaction-report-${Date.now()}.xlsx`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error exporting transaction report:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Export all items (full data export)
// @route   POST /api/excel/full-export
// @access  Private
exports.exportFullData = async (req, res) => {
  try {
    const items = await Item.find()
      .populate('category', 'name')
      .populate('createdBy', 'username')
      .sort('name');
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = req.user.username;
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet('Full Inventory Data');
    
    // Add title
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'FULL INVENTORY DATA EXPORT';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 25;
    
    worksheet.addRow([]);
    worksheet.getCell('A2').value = `Exported: ${formatDateTime(new Date())}`;
    worksheet.addRow([]);
    
    // Headers
    const headerRow = worksheet.addRow([
      'Item ID',
      'Name',
      'SKU',
      'Category',
      'Description',
      'Quantity',
      'Unit',
      'Min Stock Level',
      'Created By',
      'Created At'
    ]);
    styleHeaderRow(headerRow);
    
    // Data
    items.forEach(item => {
      worksheet.addRow([
        item._id.toString(),
        item.name,
        item.sku || '',
        item.category?.name || '',
        item.description || '',
        item.quantity,
        item.unit,
        item.minStockLevel,
        item.createdBy?.username || '',
        formatDateTime(item.createdAt)
      ]);
    });
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const length = cell.value ? cell.value.toString().length : 10;
        if (length > maxLength) maxLength = length;
      });
      column.width = Math.min(maxLength + 2, 40);
    });
    
    // Freeze header
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 4 }
    ];
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=full-inventory-export-${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error exporting full data:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
