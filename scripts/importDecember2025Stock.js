/**
 * Import DECEMBER 2025 stock items from 2024-RPC1-MOOE FINAL.xlsx into the database.
 * Sheet "December 2025" = Physical count layout: Stock No (A), Category (B), Description (C), Stock No (D), Unit (E), then quantity in later columns.
 * Run from backend: node scripts/importDecember2025Stock.js
 */
const path = require('path');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Item = require('../models/Item');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const User = require('../models/User');

const EXCEL_PATH = path.join(process.env.USERPROFILE || '', 'Downloads', '2024-RPC1-MOOE FINAL.xlsx');
const SHEET_NAME = 'December 2025';

function getCellValue(cell) {
  if (!cell) return null;
  const v = cell.value;
  if (v == null) return null;
  if (typeof v === 'object' && v.result !== undefined) return v.result; // formula
  if (typeof v === 'object' && v.richText) return v.richText.map(t => t.text).join('');
  return v;
}

function getQuantityFromRow(row) {
  for (let col = 6; col <= 20; col++) {
    const val = getCellValue(row.getCell(col));
    if (val != null && val !== '') {
      const num = Number(val);
      if (!Number.isNaN(num) && num >= 0) return num;
    }
  }
  return 0;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected.');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_PATH);
    const sheet = workbook.getWorksheet(SHEET_NAME);
    if (!sheet) {
      throw new Error(`Sheet "${SHEET_NAME}" not found. Sheets: ${workbook.worksheets.map(ws => ws.name).join(', ')}`);
    }

    const admin = await User.findOne({ role: 'admin' });
    if (!admin) throw new Error('No admin user found. Run seed to create an admin first.');

    let category = await Category.findOne({ name: 'MOOE' });
    if (!category) {
      category = await Category.create({ name: 'MOOE', description: 'MOOE supplies' });
      console.log('Created category: MOOE');
    }

    const DATA_START_ROW = 14;
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let r = DATA_START_ROW; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const stockNo = (getCellValue(row.getCell(1)) || getCellValue(row.getCell(4)) || '').toString().trim();
      const categoryName = (getCellValue(row.getCell(2)) || '').toString().trim();
      const description = (getCellValue(row.getCell(3)) || '').toString().trim();
      const unitRaw = (getCellValue(row.getCell(5)) || 'pcs').toString().trim();
      const unit = unitRaw || 'pcs';

      if (!stockNo || (!description && !categoryName)) {
        skipped++;
        continue;
      }

      const name = description || categoryName || stockNo;
      const quantity = getQuantityFromRow(row);

      const existing = await Item.findOne({ sku: stockNo });
      if (existing) {
        const oldQty = existing.quantity;
        existing.name = name;
        existing.description = description || existing.description;
        existing.unit = unit;
        existing.quantity = quantity;
        existing.updatedAt = new Date();
        await existing.save();
        if (quantity !== oldQty && quantity > 0) {
          await Transaction.create({
            item: existing._id,
            type: 'in',
            quantity: quantity - oldQty,
            balanceAfter: quantity,
            notes: `Import December 2025 - quantity set to ${quantity}`,
            performedBy: admin._id
          });
        }
        updated++;
      } else {
        const newItem = await Item.create({
          name,
          description: description || undefined,
          sku: stockNo,
          category: category._id,
          quantity,
          unit,
          minStockLevel: 10,
          createdBy: admin._id
        });
        if (quantity > 0) {
          await Transaction.create({
            item: newItem._id,
            type: 'in',
            quantity,
            balanceAfter: quantity,
            notes: 'Initial stock - Import December 2025',
            performedBy: admin._id
          });
        }
        created++;
      }
    }

    console.log(`Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Import error:', err);
    process.exit(1);
  }
}

run();
