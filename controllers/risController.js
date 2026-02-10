const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const Request = require('../models/Request');
const Item = require('../models/Item');
const Transaction = require('../models/Transaction');

// Helper function to format date
const formatDate = (date) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
};

// Helper function to generate RIS number based on formula: Ryyyy-mmdd-nnn
// where nnn is the sequential number of RIS generated on that day (padded to 3 digits)
const generateRISNumber = async (date = new Date()) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  // Format the date prefix: Ryyyy-mmdd-
  const datePrefix = `R${year}-${month}${day}-`;
  
  // Count how many RIS numbers exist for this date
  const count = await Request.countDocuments({
    risNumber: { $regex: `^${datePrefix}` }
  });
  
  // Generate the new sequential number (count + 1), padded to 3 digits
  const sequentialNumber = String(count + 1).padStart(3, '0');
  
  return `${datePrefix}${sequentialNumber}`;
};

// @desc    Generate RIS (Requisition and Issue Slip) from template
// @route   POST /api/ris/generate/:requestId
// @access  Private (users can generate RIS for their own approved requests)
exports.generateRIS = async (req, res) => {
  try {
    const request = await Request.findById(req.params.requestId)
      .populate('item', 'name sku description category quantity')
      .populate('items.item', 'name sku description category quantity')
      .populate('requestedBy', 'username email')
      .populate('reviewedBy', 'username');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check if user is authorized (admin or request owner)
    if (req.user.role !== 'admin' && request.requestedBy._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to generate RIS for this request'
      });
    }

    // Check if request has at least one approved item
    const hasApprovedItems = request.items && request.items.length > 0 
      ? request.items.some(item => item.status === 'approved')
      : request.status === 'approved';

    if (!hasApprovedItems) {
      return res.status(400).json({
        success: false,
        message: 'Can only generate RIS for requests with at least one approved item'
      });
    }

    // Load the template
    const templatePath = path.join(__dirname, '../templates/RIS-Template-A4.xlsx');
    
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({
        success: false,
        message: 'RIS template not found'
      });
    }

    // Create a new workbook and read the template
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    
    // Get the first worksheet
    const worksheet = workbook.worksheets[0];
    
    if (!worksheet) {
      console.error('Available worksheets:', workbook.worksheets.map(ws => ws.name));
      return res.status(500).json({
        success: false,
        message: 'Could not access worksheet in template'
      });
    }

    // Set page orientation to landscape (optional - uncomment if needed)
    // worksheet.pageSetup.orientation = 'landscape';
    // worksheet.pageSetup.paperSize = 9; // A4

    // Generate or retrieve RIS number
    let risNumber = request.risNumber;
    
    // If no RIS number exists, generate one and save it
    if (!risNumber) {
      // Use the approval date (reviewedAt) or fall back to creation date
      const dateForRIS = request.reviewedAt || request.createdAt;
      risNumber = await generateRISNumber(dateForRIS);
      request.risNumber = risNumber;
      await request.save();
    }
    
    // Looking at the generated image, I can see the exact positions:
    // Row 3: Entity Name (A3), Fund Cluster (F3)
    // Row 5: Division (A5 label, B5 value), RCC (E5)
    // Row 6: Office (A6 label, B6 value), RIS No (E6 value)
    // Row 8: Headers for Requisition table
    // Row 9+: Item details (A=Stock No, B=Unit, C=Description, D=Qty)
    
    // Based on your template image:
    
    // Don't overwrite existing labels, only fill in dynamic values
    // The template already has most labels pre-filled
    
    // RIS Number - Cell G8
    worksheet.getCell('G8').value = risNumber;
    
    // Budget Source - Cell H7 (MOOE or SSP)
    worksheet.getCell('H7').value = request.budgetSource || 'MOOE';
    
    // Item details start at row 11 (first data row after headers in row 10)
    // Based on template: Stock No. | Unit | Description | Qty (Requisition) | Stock Available (Yes/No) | Qty (Issue) | Remarks
    
    // Check if this is a multi-item request or single item
    const itemsToProcess = request.items && request.items.length > 0 
      ? request.items 
      : [{ item: request.item, quantity: request.quantity, unit: request.unit, status: request.status }];
    
    console.log('Items to process for RIS:', JSON.stringify(itemsToProcess.map(item => ({
      itemId: item.item?._id || item.item,
      quantity: item.quantity,
      unit: item.unit,
      status: item.status
    })), null, 2));
    
    // Fetch fresh item data (for names, sku, and fallback when no history)
    const itemsWithFreshStock = await Promise.all(
      itemsToProcess.map(async (reqItem) => {
        const freshItem = await Item.findById(reqItem.item._id || reqItem.item);
        return {
          item: reqItem.item,
          quantity: reqItem.quantity,
          unit: reqItem.unit,
          status: reqItem.status,
          freshItemData: freshItem
        };
      })
    );

    // Remaining stock after issue from transaction history (so past RIS show correct historical balance)
    const issueTxns = await Transaction.find({ request: request._id, type: 'out' });
    const balanceAfterIssueByItem = {};
    issueTxns.forEach((t) => {
      if (t.balanceAfter != null) {
        balanceAfterIssueByItem[t.item.toString()] = t.balanceAfter;
      }
    });
    
    // Add each item starting from row 11
    itemsWithFreshStock.forEach((reqItem, index) => {
      const rowNum = 11 + index;
      const itemIdStr = (reqItem.item._id || reqItem.item).toString();
      const balanceAfterIssue = balanceAfterIssueByItem[itemIdStr];

      // Stock No. (Column A)
      worksheet.getCell(`A${rowNum}`).value = reqItem.freshItemData?.sku || reqItem.item?.sku || 'N/A';
      
      // Unit (Column B)  
      worksheet.getCell(`B${rowNum}`).value = reqItem.unit || 'pcs';
      
      // Description (Column C)
      worksheet.getCell(`C${rowNum}`).value = reqItem.freshItemData?.name || reqItem.item?.name || '';
      
      // Qty - Requisition (Column D)
      worksheet.getCell(`D${rowNum}`).value = parseInt(reqItem.quantity) || 0;
      
      // Stock Available - Check if there was sufficient stock
      // Column E for "Yes", Column F for "No"
      const hadSufficientStock = reqItem.status === 'approved';
      if (hadSufficientStock) {
        worksheet.getCell(`E${rowNum}`).value = 'X'; // Mark "Yes"
      } else {
        worksheet.getCell(`F${rowNum}`).value = 'X'; // Mark "No"
      }
      
      // Qty - Issue (Column G) - Remaining stock after this issue (balanceAfter); fallback to current stock for old requests
      worksheet.getCell(`G${rowNum}`).value = balanceAfterIssue != null ? balanceAfterIssue : (reqItem.freshItemData?.quantity ?? 0);
      
      // Remarks (Column H) - Show "Issued" if approved, "Rejected" if rejected
      if (reqItem.status === 'approved') {
        worksheet.getCell(`H${rowNum}`).value = 'Issued';
      } else if (reqItem.status === 'rejected') {
        worksheet.getCell(`H${rowNum}`).value = 'Rejected';
      }
    });
    
    // Purpose (Row 23, Column B - after "Purpose:" label)
    worksheet.getCell('B23').value = request.purpose;
    
    // Signature Section
    // Based on photo 2 template structure
    
    // REQUESTED BY section (Left column - Column C for values)
    // Printed Name (Row 26)
    worksheet.getCell('C26').value = request.requestedByName || '';
    // Designation (Row 27)
    worksheet.getCell('C27').value = request.requestedByDesignation || '';
    // Date (Row 28)
    worksheet.getCell('C28').value = formatDate(request.createdAt);
    
    // APPROVED AND ISSUED BY (Middle section - Columns D-F)
    // DO NOT MODIFY D26, D27 - Template has CHRISTOPHER DC. AQUILO
    // Template already has the correct values
    // Date (Row 28) - Add realtime date when RIS is generated
    worksheet.getCell('D28').value = formatDate(new Date());
    
    // RECEIVED BY section (Right column - Column H for values)
    // Printed Name (Row 26)
    worksheet.getCell('H26').value = request.receivedByName || '';
    // Designation (Row 27)
    worksheet.getCell('H27').value = request.receivedByDesignation || '';
    // Date (Row 28)
    worksheet.getCell('H28').value = formatDate(request.createdAt);
    
    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=RIS-${risNumber}-${Date.now()}.xlsx`);
    
    // Send the file
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating RIS:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Generate RIS with custom data (for manual RIS creation)
// @route   POST /api/ris/generate-custom
// @access  Private/Admin
exports.generateCustomRIS = async (req, res) => {
  try {
    const {
      entityName,
      fundCluster,
      division,
      responsibilityCenter,
      items, // Array of { stockNo, description, unit, quantity }
      purpose,
      requestedBy,
      requestedByPosition,
      approvedBy,
      issuedBy,
      receivedBy
    } = req.body;

    // Load the template
    const templatePath = path.join(__dirname, '../templates/RIS-Template-A4.xlsx');
    
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({
        success: false,
        message: 'RIS template not found'
      });
    }

    // Create a new workbook and read the template
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    
    // Get the first worksheet
    const worksheet = workbook.worksheets[0];
    
    if (!worksheet) {
      return res.status(500).json({
        success: false,
        message: 'Could not access worksheet in template'
      });
    }

    // Generate RIS number using the new formula
    const risNumber = await generateRISNumber();
    
    // Populate header information based on template structure
    worksheet.getCell('A5').value = `Entity Name ${entityName || 'TESDA Provincial Training Center - Lipa'}`;
    worksheet.getCell('B7').value = division || 'TESDA PTC Lipa';
    worksheet.getCell('B8').value = division || 'TESDA PTC Lipa';
    worksheet.getCell('G8').value = risNumber;
    
    // Populate items (starting from row 10)
    if (items && items.length > 0) {
      items.forEach((item, index) => {
        const row = 10 + index;
        worksheet.getCell(`A${row}`).value = item.stockNo || '';
        worksheet.getCell(`B${row}`).value = item.unit || '';
        worksheet.getCell(`C${row}`).value = item.description || '';
        worksheet.getCell(`D${row}`).value = item.quantity || 0;
      });
    }
    
    // Populate purpose
    worksheet.getCell('A23').value = `Purpose: ${purpose || ''}`;
    
    // Populate signature fields
    worksheet.getCell('B26').value = requestedBy || req.user.username;
    worksheet.getCell('B27').value = requestedByPosition || '';
    worksheet.getCell('B28').value = formatDate(new Date());
    
    worksheet.getCell('E26').value = approvedBy || issuedBy || 'CHRISTOPHER DC. AQUILO';
    worksheet.getCell('E27').value = 'Designated Admin. Officer | Supply/Property Custodian';
    
    if (receivedBy) {
      worksheet.getCell('H26').value = receivedBy;
    }
    
    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=RIS-${risNumber}.xlsx`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating custom RIS:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Preview RIS template structure (for debugging/setup)
// @route   GET /api/ris/preview-template
// @access  Private/Admin
exports.previewTemplate = async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../templates/RIS-Template-A4.xlsx');
    
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        success: false,
        message: 'RIS template not found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    
    const worksheet = workbook.worksheets[0];
    
    // Extract all cells with content
    const cells = {};
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const cellAddress = cell.address;
        cells[cellAddress] = {
          value: cell.value,
          type: cell.type
        };
      });
    });
    
    res.status(200).json({
      success: true,
      sheetName: worksheet.name,
      cells,
      message: 'Use this information to map your data to the correct cells'
    });
    
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper function to fill a single RIS template on a worksheet
// rowOffset: 0 for first RIS template, 31 for second RIS template (adjust based on your template)
const fillRISWorksheet = async (worksheet, request, rowOffset = 0) => {
  // Generate or retrieve RIS number
  let risNumber = request.risNumber;
  
  // If no RIS number exists, generate one and save it
  if (!risNumber) {
    // Use the approval date (reviewedAt) or fall back to creation date
    const dateForRIS = request.reviewedAt || request.createdAt;
    risNumber = await generateRISNumber(dateForRIS);
    request.risNumber = risNumber;
    await request.save();
  }
  
  // RIS Number - Cell G8 (or G8 + offset)
  worksheet.getCell(`G${8 + rowOffset}`).value = risNumber;
  
  // Budget Source - Cell H7 (MOOE or SSP)
  worksheet.getCell(`H${7 + rowOffset}`).value = request.budgetSource || 'MOOE';
  
  // Check if this is a multi-item request or single item
  const itemsToProcess = request.items && request.items.length > 0 
    ? request.items 
    : [{ item: request.item, quantity: request.quantity, unit: request.unit, status: request.status }];
  
  // Fetch fresh item data
  const itemsWithFreshStock = await Promise.all(
    itemsToProcess.map(async (reqItem) => {
      const freshItem = await Item.findById(reqItem.item._id || reqItem.item);
      return {
        item: reqItem.item,
        quantity: reqItem.quantity,
        unit: reqItem.unit,
        status: reqItem.status,
        freshItemData: freshItem
      };
    })
  );

  // Remaining stock after issue from transaction history
  const issueTxns = await Transaction.find({ request: request._id, type: 'out' });
  const balanceAfterIssueByItem = {};
  issueTxns.forEach((t) => {
    if (t.balanceAfter != null) {
      balanceAfterIssueByItem[t.item.toString()] = t.balanceAfter;
    }
  });
  
  // Add each item starting from row 11 (+ offset)
  itemsWithFreshStock.forEach((reqItem, index) => {
    const rowNum = 11 + rowOffset + index;
    const itemIdStr = (reqItem.item._id || reqItem.item).toString();
    const balanceAfterIssue = balanceAfterIssueByItem[itemIdStr];

    // Stock No. (Column A)
    worksheet.getCell(`A${rowNum}`).value = reqItem.freshItemData?.sku || reqItem.item?.sku || 'N/A';
    
    // Unit (Column B)  
    worksheet.getCell(`B${rowNum}`).value = reqItem.unit || 'pcs';
    
    // Description (Column C)
    worksheet.getCell(`C${rowNum}`).value = reqItem.freshItemData?.name || reqItem.item?.name || '';
    
    // Qty - Requisition (Column D)
    worksheet.getCell(`D${rowNum}`).value = parseInt(reqItem.quantity) || 0;
    
    // Stock Available - Check if there was sufficient stock
    // Column E for "Yes", Column F for "No"
    const hadSufficientStock = reqItem.status === 'approved';
    if (hadSufficientStock) {
      worksheet.getCell(`E${rowNum}`).value = 'X'; // Mark "Yes"
    } else {
      worksheet.getCell(`F${rowNum}`).value = 'X'; // Mark "No"
    }
    
    // Qty - Issue (Column G)
    worksheet.getCell(`G${rowNum}`).value = balanceAfterIssue != null ? balanceAfterIssue : (reqItem.freshItemData?.quantity ?? 0);
    
    // Remarks (Column H)
    if (reqItem.status === 'approved') {
      worksheet.getCell(`H${rowNum}`).value = 'Issued';
    } else if (reqItem.status === 'rejected') {
      worksheet.getCell(`H${rowNum}`).value = 'Rejected';
    }
  });
  
  // Purpose (Row 23 + offset, Column B)
  worksheet.getCell(`B${23 + rowOffset}`).value = request.purpose;
  
  // REQUESTED BY section
  worksheet.getCell(`C${26 + rowOffset}`).value = request.requestedByName || '';
  worksheet.getCell(`C${27 + rowOffset}`).value = request.requestedByDesignation || '';
  worksheet.getCell(`C${28 + rowOffset}`).value = formatDate(request.createdAt);
  
  // APPROVED AND ISSUED BY (Date)
  worksheet.getCell(`D${28 + rowOffset}`).value = formatDate(new Date());
  
  // RECEIVED BY section
  worksheet.getCell(`H${26 + rowOffset}`).value = request.receivedByName || '';
  worksheet.getCell(`H${27 + rowOffset}`).value = request.receivedByDesignation || '';
  worksheet.getCell(`H${28 + rowOffset}`).value = formatDate(request.createdAt);
};

// @desc    Generate batch RIS (multiple RIS in one file, 2 per worksheet)
// @route   POST /api/ris/generate-batch
// @access  Private
exports.generateRISBatch = async (req, res) => {
  try {
    const { requestIds } = req.body;
    
    // Validate at least 2 requests
    if (!requestIds || !Array.isArray(requestIds) || requestIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least 2 request IDs for batch generation'
      });
    }

    // Fetch all requests
    const requests = await Promise.all(
      requestIds.map(id => 
        Request.findById(id)
          .populate('item', 'name sku description category quantity')
          .populate('items.item', 'name sku description category quantity')
          .populate('requestedBy', 'username email')
          .populate('reviewedBy', 'username')
      )
    );

    // Validate all requests exist
    const missingRequests = requests.filter(r => !r);
    if (missingRequests.length > 0) {
      return res.status(404).json({
        success: false,
        message: 'One or more requests not found'
      });
    }

    // Check authorization for all requests
    for (const request of requests) {
      if (req.user.role !== 'admin' && request.requestedBy._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to generate RIS for one or more requests'
        });
      }

      // Check if request has at least one approved item
      const hasApprovedItems = request.items && request.items.length > 0 
        ? request.items.some(item => item.status === 'approved')
        : request.status === 'approved';

      if (!hasApprovedItems) {
        return res.status(400).json({
          success: false,
          message: `Request ${request._id} does not have approved items`
        });
      }
    }

    // Load the SET template
    const templatePath = path.join(__dirname, '../templates/RIS-Template-A4 - SET.xlsx');
    
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({
        success: false,
        message: 'RIS SET template not found'
      });
    }

    // Calculate how many worksheets needed (2 RIS per worksheet)
    const worksheetsNeeded = Math.ceil(requests.length / 2);
    
    // PHASE 1: Load template and create worksheets
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    
    const firstSheet = workbook.worksheets[0];
    const worksheets = [firstSheet];
    
    // For additional worksheets, manually copy everything from first sheet
    for (let wsIndex = 1; wsIndex < worksheetsNeeded; wsIndex++) {
      const newSheet = workbook.addWorksheet(`RIS Set ${wsIndex + 1}`);
      
      // Copy worksheet properties
      newSheet.properties = Object.assign({}, firstSheet.properties);
      newSheet.pageSetup = Object.assign({}, firstSheet.pageSetup);
      if (firstSheet.headerFooter) {
        newSheet.headerFooter = Object.assign({}, firstSheet.headerFooter);
      }
      if (firstSheet.views) {
        newSheet.views = JSON.parse(JSON.stringify(firstSheet.views));
      }
      
      // Copy columns (width and style)
      firstSheet.columns.forEach((col, idx) => {
        const newCol = newSheet.getColumn(idx + 1);
        if (col.width) newCol.width = col.width;
        if (col.style) newCol.style = Object.assign({}, col.style);
        if (col.hidden) newCol.hidden = col.hidden;
      });
      
      // Copy all rows and cells
      firstSheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
        const newRow = newSheet.getRow(rowNum);
        if (row.height) newRow.height = row.height;
        if (row.hidden) newRow.hidden = row.hidden;
        if (row.outlineLevel) newRow.outlineLevel = row.outlineLevel;
        
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          const newCell = newRow.getCell(colNum);
          
          // Copy value
          if (cell.value !== undefined && cell.value !== null) {
            newCell.value = cell.value;
          }
          
          // Copy style properties individually for better reliability
          if (cell.numFmt) newCell.numFmt = cell.numFmt;
          if (cell.font) newCell.font = Object.assign({}, cell.font);
          if (cell.alignment) newCell.alignment = Object.assign({}, cell.alignment);
          if (cell.border) {
            newCell.border = {
              top: cell.border.top ? Object.assign({}, cell.border.top) : undefined,
              left: cell.border.left ? Object.assign({}, cell.border.left) : undefined,
              bottom: cell.border.bottom ? Object.assign({}, cell.border.bottom) : undefined,
              right: cell.border.right ? Object.assign({}, cell.border.right) : undefined,
              diagonal: cell.border.diagonal ? Object.assign({}, cell.border.diagonal) : undefined
            };
          }
          if (cell.fill) newCell.fill = Object.assign({}, cell.fill);
          if (cell.protection) newCell.protection = Object.assign({}, cell.protection);
        });
        
        newRow.commit();
      });
      
      // Copy merged cells - use model.merges which is the proper way
      if (firstSheet.model && firstSheet.model.merges) {
        firstSheet.model.merges.forEach(merge => {
          try {
            // merge is in the format "A1:B2"
            newSheet.mergeCells(merge);
          } catch (e) {
            console.error('Error merging cells:', merge, e.message);
          }
        });
      }
      
      // Also try the internal _merges as backup
      if (firstSheet._merges) {
        Object.keys(firstSheet._merges).forEach(range => {
          try {
            // Check if not already merged
            const alreadyMerged = newSheet.model && newSheet.model.merges && 
                                  newSheet.model.merges.includes(range);
            if (!alreadyMerged) {
              newSheet.mergeCells(range);
            }
          } catch (e) {
            // Ignore duplicate merge errors
          }
        });
      }
      
      worksheets.push(newSheet);
    }
    
    // PHASE 2: Fill all worksheets with request data
    for (let wsIndex = 0; wsIndex < worksheetsNeeded; wsIndex++) {
      const worksheet = worksheets[wsIndex];
      
      // Fill first RIS in this worksheet (top form)
      const firstRequestIndex = wsIndex * 2;
      if (requests[firstRequestIndex]) {
        await fillRISWorksheet(worksheet, requests[firstRequestIndex], 0);
      }
      
      // Fill second RIS in this worksheet (bottom form) if it exists
      const secondRequestIndex = wsIndex * 2 + 1;
      if (requests[secondRequestIndex]) {
        await fillRISWorksheet(worksheet, requests[secondRequestIndex], 29);
      }
    }

    // Generate buffer and send
    const buffer = await workbook.xlsx.writeBuffer();
    
    const filename = `RIS-Batch-${requests.length}requests-${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating batch RIS:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
