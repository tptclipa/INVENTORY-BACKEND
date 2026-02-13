/**
 * One-off script to inspect Excel file structure (sheets, headers, sample rows).
 * Run from backend: node scripts/inspectExcel.js
 */
const path = require('path');
const ExcelJS = require('exceljs');

const filePath = path.join(process.env.USERPROFILE || '', 'Downloads', '2024-RPC1-MOOE FINAL.xlsx');

async function run() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  console.log('Sheets:', workbook.worksheets.map(ws => ws.name));
  workbook.worksheets.forEach(ws => {
    console.log('\n--- Sheet:', ws.name, '---');
    const rowCount = Math.min(ws.rowCount, 15);
    for (let r = 1; r <= rowCount; r++) {
      const row = ws.getRow(r);
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values.push(`C${colNumber}:${cell.value === null || cell.value === undefined ? '' : String(cell.value).slice(0, 40)}`);
      });
      console.log(`Row ${r}:`, values.slice(0, 20).join(' | '));
    }
  });
}

run().catch(err => { console.error(err); process.exit(1); });
