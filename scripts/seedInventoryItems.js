/**
 * Seed inventory items from the inventory list.
 * Each item: quantity 50, minStockLevel 10; category matched by name (case-insensitive).
 * Skips items that already exist (by SKU). Creates initial "in" transaction for quantity.
 * Run from backend: node scripts/seedInventoryItems.js
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Item = require('../models/Item');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const User = require('../models/User');

const INITIAL_QUANTITY = 50;
const MIN_STOCK_LEVEL = 10;

// 106 items: Category (must match DB category name), Name, Stock No, Unit
const INVENTORY_DATA = [
  { category: 'Bond Paper', name: 'Bond paper, A4', stockNo: 'OS-001', unit: 'reams' },
  { category: 'Bond Paper', name: 'Bond paper, A4 multicopy 80gsm', stockNo: 'OS-002', unit: 'reams' },
  { category: 'Envelope', name: 'Envelope, Legal Size Red With S', stockNo: 'OS-003', unit: 'pcs' },
  { category: 'Envelope', name: 'Envelope, Legal size', stockNo: 'OS-004', unit: 'pcs' },
  { category: 'Specialty Paper', name: 'Specialty paper', stockNo: 'OS-005', unit: 'reams' },
  { category: 'Especialty Board', name: 'Especialty board', stockNo: 'OS-006', unit: 'pcs' },
  { category: 'Sticky Note Pad', name: 'Sticky note pad, size 1.5x2', stockNo: 'OS-007', unit: 'pcs' },
  { category: 'Sticky Note Pad', name: 'Sticky note pad', stockNo: 'OS-008', unit: 'pcs' },
  { category: 'Marker', name: 'Marker, Permanent black', stockNo: 'OS-009', unit: 'pcs' },
  { category: 'Marker', name: 'Marker, Permanent', stockNo: 'OS-010', unit: 'pcs' },
  { category: 'Ink', name: 'Refill ink, black, 30ml', stockNo: 'OS-011', unit: 'btl' },
  { category: 'Ink', name: 'Ink, black', stockNo: 'OS-012', unit: 'btl' },
  { category: 'Ink', name: 'Ink refill', stockNo: 'OS-013', unit: 'btl' },
  { category: 'Highligher', name: 'Stabilo Boss, neon', stockNo: 'OS-014', unit: 'pcs' },
  { category: 'File Divider', name: 'File divider', stockNo: 'OS-015', unit: 'pcs' },
  { category: 'Battery', name: 'AA size, non recharge', stockNo: 'OS-016', unit: 'pcs' },
  { category: 'Battery', name: 'DryCell, size AA', stockNo: 'OS-017', unit: 'pcs' },
  { category: 'Battery', name: 'AAA battery', stockNo: 'OS-018', unit: 'pcs' },
  { category: 'Clamp', name: 'Paper clamp, Small 3/', stockNo: 'OS-019', unit: 'pcs' },
  { category: 'Clamp', name: 'Paper clamp', stockNo: 'OS-020', unit: 'pcs' },
  { category: 'Stapler', name: 'Stapler, desktop', stockNo: 'OS-021', unit: 'pcs' },
  { category: 'Stapler', name: 'Stapler', stockNo: 'OS-022', unit: 'pcs' },
  { category: 'Tape', name: 'Masking, 1"', stockNo: 'OS-023', unit: 'rolls' },
  { category: 'Tape', name: 'Tape, masking', stockNo: 'OS-024', unit: 'rolls' },
  { category: 'Tape', name: 'Transparent tape', stockNo: 'OS-025', unit: 'rolls' },
  { category: 'Alcohol', name: '70%, 1 Gal', stockNo: 'OS-026', unit: 'Galon' },
  { category: 'Alcohol', name: 'Ethyl alcohol 70%', stockNo: 'OS-027', unit: 'btl' },
  { category: 'Fastener', name: 'Fastener', stockNo: 'OS-028', unit: 'pcs' },
  { category: 'Record Book', name: 'Record book', stockNo: 'OS-029', unit: 'pcs' },
  { category: 'Tissue', name: 'Toilet tissue paper 2-ply', stockNo: 'OS-030', unit: 'pcs' },
  { category: 'Tissue', name: 'Facial Tissue', stockNo: 'OS-031', unit: 'box' },
  { category: 'Tissue', name: 'Tissue paper', stockNo: 'OS-032', unit: 'box' },
  { category: 'Staple Wire', name: 'Staple wire', stockNo: 'OS-033', unit: 'box' },
  { category: 'Staple Wire', name: 'Staple wire, standard', stockNo: 'OS-034', unit: 'box' },
  { category: 'Disinfectant Spray', name: 'Disinfectant spray, lysol', stockNo: 'OS-035', unit: 'btl' },
  { category: 'Disinfectant Spray', name: 'Disinfectant spray', stockNo: 'OS-036', unit: 'btl' },
  { category: 'Glue', name: 'Glue stick', stockNo: 'OS-037', unit: 'pcs' },
  { category: 'Glue', name: 'Glue, white', stockNo: 'OS-038', unit: 'btl' },
  { category: 'Sticky Note', name: 'Sticky note', stockNo: 'OS-039', unit: 'pcs' },
  { category: 'Cutter', name: 'Cutter, safety', stockNo: 'OS-040', unit: 'pcs' },
  { category: 'Cutter', name: 'Cutter', stockNo: 'OS-041', unit: 'pcs' },
  { category: 'Rubber Band', name: 'Rubber band', stockNo: 'OS-042', unit: 'pcs' },
  { category: 'Rubber Band', name: 'Rubber band, assorted', stockNo: 'OS-043', unit: 'packs' },
  { category: 'Mouse', name: 'Wireless, black', stockNo: 'OS-044', unit: 'pcs' },
  { category: 'Mouse', name: 'Optical mouse', stockNo: 'OS-045', unit: 'pcs' },
  { category: 'Trash Bag', name: 'TrashBag Small', stockNo: 'OS-046', unit: 'pcs' },
  { category: 'Trash Bag', name: 'Trash bag, medium', stockNo: 'OS-047', unit: 'pcs' },
  { category: 'Trash Bag', name: 'Trash bag, large', stockNo: 'OS-048', unit: 'pcs' },
  { category: 'Folder', name: 'Folder, document', stockNo: 'OS-049', unit: 'pcs' },
  { category: 'Folder', name: 'Folder', stockNo: 'OS-050', unit: 'pcs' },
  { category: 'Pen', name: 'Correction pen', stockNo: 'OS-051', unit: 'pcs' },
  { category: 'Pen', name: 'Ballpen, black', stockNo: 'OS-052', unit: 'pcs' },
  { category: 'Pen', name: 'Sign pen', stockNo: 'OS-053', unit: 'pcs' },
  { category: 'Laminating Pouches', name: 'Laminating pouches', stockNo: 'OS-054', unit: 'pcs' },
  { category: 'Certificate Holder', name: 'Certificate holder', stockNo: 'OS-055', unit: 'pcs' },
  { category: 'Sponge', name: 'Sponge', stockNo: 'OS-056', unit: 'pcs' },
  { category: 'Scrub With Brush', name: 'Scrub with brush', stockNo: 'OS-057', unit: 'pcs' },
  { category: 'Gloves', name: 'Gloves, rubber', stockNo: 'OS-058', unit: 'pairs' },
  { category: 'Paper Towel', name: 'Paper towel', stockNo: 'OS-059', unit: 'rolls' },
  { category: 'Cleaning Cloth', name: 'Cleaning cloth', stockNo: 'OS-060', unit: 'pcs' },
  { category: 'Liquid Detergent', name: 'Liquid detergent', stockNo: 'OS-061', unit: 'btl' },
  { category: 'Powder Soap', name: 'Powder soap, 2kg', stockNo: 'OS-062', unit: 'box' },
  { category: 'Powder Soap', name: 'Powder soap', stockNo: 'OS-063', unit: 'box' },
  { category: 'Dishwashing Liquid', name: 'Dishwashing liquid', stockNo: 'OS-064', unit: 'btl' },
  { category: 'Toilet Cleaner', name: 'Toilet cleaner', stockNo: 'OS-065', unit: 'btl' },
  { category: 'Garbage Bag', name: 'Garbage bag', stockNo: 'OS-066', unit: 'pcs' },
  { category: 'Garbage Bag', name: 'Garbage bag, heavy duty', stockNo: 'OS-067', unit: 'pcs' },
  { category: 'Mop', name: 'Floor mop, tornado w', stockNo: 'OS-068', unit: 'pcs' },
  { category: 'Mop', name: 'Mop head', stockNo: 'OS-069', unit: 'pcs' },
  { category: 'Ruler', name: 'Ruler, 12 inch', stockNo: 'OS-070', unit: 'pcs' },
  { category: 'Ruler', name: 'Ruler', stockNo: 'OS-071', unit: 'pcs' },
  { category: 'Pencil Sharpener', name: 'Pencil sharpener', stockNo: 'OS-072', unit: 'pcs' },
  { category: 'Stamp Pad', name: 'Stamp pad', stockNo: 'OS-073', unit: 'pcs' },
  { category: 'Rags', name: 'Rags', stockNo: 'OS-074', unit: 'pcs' },
  { category: 'Sign Pen', name: 'Sign pen', stockNo: 'OS-075', unit: 'pcs' },
  { category: 'Detergent Bar', name: 'Detergent bar', stockNo: 'OS-076', unit: 'bar' },
  { category: 'Handbook', name: 'RA 9184, 8th edition', stockNo: 'OS-077', unit: 'pcs' },
  { category: 'Handbook', name: 'Handbook', stockNo: 'OS-078', unit: 'pcs' },
  { category: 'Eraser', name: 'Eraser', stockNo: 'OS-079', unit: 'pcs' },
  { category: 'Tape Dispenser', name: 'Tape dispenser', stockNo: 'OS-080', unit: 'pcs' },
  { category: 'Staple Remover', name: 'Staple remover', stockNo: 'OS-081', unit: 'pcs' },
  { category: 'BLEACH', name: 'Bleach', stockNo: 'OS-082', unit: 'btl' },
  { category: 'Scrubbing Pad', name: 'Scrubbing Pad', stockNo: 'OS-083', unit: 'pcs' },
  { category: 'Floor Conditioner', name: 'Floor Conditioner', stockNo: 'OS-084', unit: 'btl' },
  { category: 'Dust Pan, Plastic', name: 'Dust Pan, Plastic', stockNo: 'OS-085', unit: 'pcs' },
  { category: 'Soft Broom', name: 'Soft broom', stockNo: 'OS-086', unit: 'pcs' },
  { category: 'Air Freshener Scent', name: 'Air Freshener Scent', stockNo: 'OS-087', unit: 'btl' },
  { category: 'Insecticide', name: 'Aerosol Insecticide, 700ml', stockNo: 'OS-088', unit: 'btl' },
  { category: 'Insecticide', name: 'Insecticide', stockNo: 'OS-089', unit: 'btl' },
  { category: 'Handwash', name: 'Antibacterial Handwash', stockNo: 'OS-090', unit: 'btl' },
  { category: 'Handwash', name: 'Handwash', stockNo: 'OS-091', unit: 'btl' },
  { category: 'Door Mat, Cloth', name: 'Door Mat, Cloth', stockNo: 'OS-092', unit: 'pcs' },
  { category: 'Spin Mop, Microfiber', name: 'Spin Mop, Microfiber', stockNo: 'OS-093', unit: 'pcs' },
  { category: 'Heavy Duty Large Mop', name: 'Heavy Duty Large Mop', stockNo: 'OS-094', unit: 'pcs' },
  { category: 'Toilet Brush', name: 'Round Toilet Brush', stockNo: 'OS-095', unit: 'pcs' },
  { category: 'Toilet Brush', name: 'Toilet Brush', stockNo: 'OS-096', unit: 'pcs' },
  { category: 'Microfiber Cloth', name: 'Microfiber Cloth', stockNo: 'OS-097', unit: 'pcs' },
  { category: 'Soap Dispenser', name: 'Soap Dispenser', stockNo: 'OS-098', unit: 'pcs' },
  { category: 'Zonrox', name: 'Zonrox', stockNo: 'OS-099', unit: 'btl' },
  { category: 'Bond Paper', name: 'Bond paper, Legal', stockNo: 'OS-100', unit: 'reams' },
  { category: 'Envelope', name: 'Envelope, long', stockNo: 'OS-101', unit: 'pcs' },
  { category: 'Ink', name: 'Ink, blue', stockNo: 'OS-102', unit: 'btl' },
  { category: 'Battery', name: 'Battery, 9V', stockNo: 'OS-103', unit: 'pcs' },
  { category: 'Staple Wire', name: 'Staple wire, heavy', stockNo: 'OS-104', unit: 'box' },
  { category: 'Tape', name: 'Double-sided tape', stockNo: 'OS-105', unit: 'rolls' },
  { category: 'Record Book', name: 'Record book, ledger', stockNo: 'OS-106', unit: 'pcs' },
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findCategoryByName(name) {
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();
  const doc = await Category.findOne({
    name: new RegExp('^' + escapeRegex(trimmed) + '$', 'i'),
  });
  return doc;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected.');

    const admin = await User.findOne({ role: 'admin' });
    if (!admin) throw new Error('No admin user found. Create an admin first.');

    const categoryCache = new Map(); // lowercase name -> Category doc
    let created = 0;
    let skipped = 0;
    let missingCategory = 0;

    for (const row of INVENTORY_DATA) {
      const categoryName = (row.category || '').trim();
      const name = (row.name || '').trim();
      const stockNo = (row.stockNo || '').trim();
      const unit = (row.unit || 'pcs').trim() || 'pcs';

      if (!name || !stockNo) {
        skipped++;
        continue;
      }

      let category = categoryCache.get(categoryName.toLowerCase());
      if (!category) {
        category = await findCategoryByName(categoryName);
        if (category) categoryCache.set(categoryName.toLowerCase(), category);
      }
      if (!category) {
        console.warn(`Category not found: "${categoryName}" for item ${stockNo} - ${name}. Skipping.`);
        missingCategory++;
        continue;
      }

      const existing = await Item.findOne({ sku: stockNo });
      if (existing) {
        skipped++;
        continue;
      }

      const item = await Item.create({
        name,
        sku: stockNo,
        category: category._id,
        quantity: INITIAL_QUANTITY,
        unit,
        minStockLevel: MIN_STOCK_LEVEL,
        createdBy: admin._id,
      });

      await Transaction.create({
        item: item._id,
        type: 'in',
        quantity: INITIAL_QUANTITY,
        balanceAfter: INITIAL_QUANTITY,
        notes: 'Initial stock - seed inventory',
        performedBy: admin._id,
      });

      created++;
      console.log(`Created: ${stockNo} ${name} (${category.name})`);
    }

    console.log(`\nDone. Created: ${created}, Skipped (existing): ${skipped}, Missing category: ${missingCategory}`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
