/**
 * Add unique item names from the provided list as Categories.
 * Skips any category that already exists (by name, case-insensitive) so nothing is doubled.
 * Run from backend: node scripts/addCategoriesFromList.js
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Category = require('../models/Category');

// Raw list from the image (with duplicates)
const RAW_NAMES = [
  'Bond Paper',
  'Envelope',
  'Specialty paper',
  'Especialty board',
  'Sticky note pad',
  'Sticky note pad',
  'Sticky note pad',
  'Sticky note pad',
  'Sticky note pad',
  'Marker',
  'Marker',
  'Marker',
  'Ink',
  'Highligher',
  'File Divider',
  'Battery',
  'Clamp',
  'Clamp',
  'Clamp',
  'Stapler',
  'Tape',
  'Tape',
  'Tape',
  'Tape',
  'Alcohol',
  'Bond Paper',
  'Fastener',
  'Envelope',
  'Ink',
  'Ink',
  'Ink',
  'Ink',
  'Ink',
  'Ink',
  'Record Book',
  'Tissue',
  'Battery',
  'Battery',
  'Staple wire',
  'Disinfectant spray',
  'Glue',
  'Sticky note',
  'Cutter',
  'Rubber band',
  'Rubber band',
  'Mouse',
  'Trash bag',
  'Trash bag',
  'Envelope',
  'Folder',
  'Bond Paper',
  'Specialty paper',
  'Staple wire',
  'Pen',
  'Ink',
  'Ink',
  'Ink',
  'Battery',
  'Tissue',
  'Marker',
  'Laminating pouches',
  'Certificate holder',
  'Sponge',
  'Scrub with brush',
  'Gloves',
  'Paper towel',
  'Cleaning cloth',
  'Liquid detergent',
  'Powder soap',
  'Dishwashing liquid',
  'Toilet cleaner',
  'Garbage bag',
  'Garbage bag',
  'Mop',
  'Ruler',
  'Stapler',
  'Pencil Sharpener',
  'Marker',
  'Marker',
  'Marker',
  'Stamp pad',
  'Rags',
  'Sign pen',
  'Detergent bar',
  'Handbook',
  'Bond paper',
  'Bond paper',
  'Bond paper',
  'Battery',
  'Eraser',
  'Tape dispenser',
  'Staple remover',
  'Staple wire',
  'Trashbag',
  'BLEACH',
  'Scrubbing Pad',
  'Trashbag',
  'Trashbag',
  'Floor Conditioner',
  'Dust Pan, Plastic',
  'Soft broom',
  'Air Freshener Scent',
  'Insecticide',
  'Handwash',
  'Door Mat, Cloth',
  'Spin Mop, Microfiber',
  'Heavy Duty Large Mop',
  'Toilet Brush',
  'Tissue',
  'Microfiber Cloth',
  'Soap Dispenser',
  'Battery',
  'zonrox',
  'Powder soap',
];

/** Normalize to title case and trim; collapse "Trashbag" / "Trash bag" to one form */
function normalizeName(raw) {
  const trimmed = (raw || '').toString().trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (lower === 'trashbag') return 'Trash Bag';
  if (lower === 'zonrox') return 'Zonrox';

  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected.');

    const normalized = RAW_NAMES.map(normalizeName).filter(Boolean);
    const uniqueNames = [...new Set(normalized)];

    const existing = await Category.find({});
    const existingNamesLower = new Set(existing.map((c) => c.name.toLowerCase()));

    let created = 0;
    let skipped = 0;

    for (const name of uniqueNames) {
      if (existingNamesLower.has(name.toLowerCase())) {
        skipped++;
        continue;
      }
      await Category.create({ name, description: '' });
      existingNamesLower.add(name.toLowerCase());
      created++;
      console.log('Created category:', name);
    }

    console.log(`\nDone. Created: ${created}, Skipped (already exist): ${skipped}`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
