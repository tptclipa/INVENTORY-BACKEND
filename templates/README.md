# Document Templates

This folder contains Word document templates (.docx) used for generating inventory reports, labels, and other documents.

## Creating Templates

Templates use placeholders in the format `{variableName}` that will be replaced with actual data.

### Available Templates

1. **inventory-report.docx** - Full inventory listing
2. **low-stock-alert.docx** - Low stock items alert
3. **transaction-report.docx** - Transaction history report
4. **item-label.docx** - Individual item label

## Template Variables

### inventory-report.docx
```
{reportDate}          - Date the report was generated
{generatedBy}         - Username who generated the report
{totalItems}          - Total number of items
{lowStockItems}       - Number of low stock items
{totalValue}          - Total quantity across all items

{#items}              - Start loop for items
  {name}              - Item name
  {sku}               - SKU code
  {category}          - Category name
  {quantity}          - Current quantity
  {unit}              - Unit of measurement
  {minStockLevel}     - Minimum stock level
  {status}            - Stock status (In Stock/Low Stock)
  {description}       - Item description
{/items}              - End loop
```

### low-stock-alert.docx
```
{reportDate}          - Date the alert was generated
{generatedBy}         - Username who generated the alert
{alertCount}          - Number of low stock items
{criticalItems}       - Number of out of stock items

{#items}              - Start loop for items
  {name}              - Item name
  {sku}               - SKU code
  {category}          - Category name
  {currentQuantity}   - Current quantity
  {minStockLevel}     - Minimum stock level
  {unit}              - Unit of measurement
  {shortage}          - Shortage amount
  {status}            - Status (OUT OF STOCK/LOW STOCK)
{/items}              - End loop
```

### transaction-report.docx
```
{reportDate}          - Date the report was generated
{generatedBy}         - Username who generated the report
{startDate}           - Report start date
{endDate}             - Report end date
{totalTransactions}   - Total number of transactions
{totalStockIn}        - Total items stocked in
{totalStockOut}       - Total items stocked out
{totalAdjustments}    - Number of adjustments

{#transactions}       - Start loop for transactions
  {date}              - Transaction date
  {item}              - Item name
  {sku}               - SKU code
  {type}              - Transaction type
  {quantity}          - Quantity
  {reason}            - Reason/notes
  {user}              - User who performed transaction
{/transactions}       - End loop
```

### item-label.docx
```
{name}                - Item name
{sku}                 - SKU code
{category}            - Category name
{quantity}            - Current quantity
{unit}                - Unit of measurement
{description}         - Item description
{dateGenerated}       - Date label was generated
```

## Creating a Template

1. Open Microsoft Word
2. Create your document layout
3. Insert placeholders using the syntax above (e.g., `{reportDate}`)
4. For repeating sections (like item lists), use:
   - `{#items}` to start the loop
   - `{/items}` to end the loop
5. Save as `.docx` format in this folder

## Example: Simple Inventory Report Template

```
INVENTORY REPORT
Generated on: {reportDate}
By: {generatedBy}

Summary:
- Total Items: {totalItems}
- Low Stock Items: {lowStockItems}

Item Details:

{#items}
Item: {name}
SKU: {sku}
Category: {category}
Quantity: {quantity} {unit}
Status: {status}
---
{/items}
```

## Tips

- Use tables for better formatting of item lists
- Add your organization's header/logo
- Use formatting (bold, colors) to highlight important information
- Keep placeholders exactly as specified (case-sensitive)
- Test templates by generating a document through the API
