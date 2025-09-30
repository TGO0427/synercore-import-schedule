import * as XLSX from 'xlsx';

const templateData = [
  {
    'SUPPLIER': 'Example Supplier Ltd',
    'ORDER/REF': 'Product Name / ORDER123',
    'FINAL POD': 'PRETORIA',
    'LATEST STATUS': 'planned_airfreight',
    'WEEK NUMBER': 36,
    'PRODUCT NAME': 'Product Name',
    'QUANTITY': 1000,
    'PALLET QTY': 2,
    'RECEIVING WAREHOUSE': 'PRETORIA',
    'NOTES': 'Example notes'
  }
];

const worksheet = XLSX.utils.json_to_sheet(templateData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'TRACKING');

XLSX.writeFile(workbook, 'shipment_template.xlsx');
console.log('Template created: shipment_template.xlsx');