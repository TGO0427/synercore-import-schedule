export class Supplier {
  constructor({
    id,
    name,
    code,
    contactEmail,
    contactPhone,
    contactPerson,
    address,
    country,
    defaultTerms,
    paymentTerms,
    currency = 'USD',
    importFormats = [],
    documentFormats = [],
    isActive = true,
    notes = ''
  }) {
    this.id = id;
    this.name = name;
    this.code = code; // Short code for supplier (e.g., "ACME", "SUPP001")
    this.contactEmail = contactEmail;
    this.contactPhone = contactPhone;
    this.contactPerson = contactPerson;
    this.address = address;
    this.country = country;
    this.defaultTerms = defaultTerms; // FOB, CIF, etc.
    this.paymentTerms = paymentTerms;
    this.currency = currency;
    this.importFormats = importFormats; // Supported file formats and templates
    this.documentFormats = documentFormats; // Document types they provide
    this.isActive = isActive;
    this.notes = notes;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  update(data) {
    Object.keys(data).forEach(key => {
      if (this.hasOwnProperty(key) && key !== 'id' && key !== 'createdAt') {
        this[key] = data[key];
      }
    });
    this.updatedAt = new Date();
  }

  getDisplayName() {
    return this.code ? `${this.name} (${this.code})` : this.name;
  }
}

export const ImportFormat = {
  EXCEL: 'excel',
  CSV: 'csv',
  JSON: 'json',
  XML: 'xml',
  EDI: 'edi'
};

export const DocumentType = {
  COMMERCIAL_INVOICE: 'commercial_invoice',
  PACKING_LIST: 'packing_list',
  BILL_OF_LADING: 'bill_of_lading',
  CERTIFICATE_OF_ORIGIN: 'certificate_of_origin',
  INSPECTION_CERTIFICATE: 'inspection_certificate',
  SHIPPING_SCHEDULE: 'shipping_schedule',
  CUSTOMS_DECLARATION: 'customs_declaration'
};

export const SupplierImportTemplate = {
  // Standard template mappings for different suppliers
  STANDARD: {
    productName: 'Product Name',
    quantity: 'Quantity',
    unitPrice: 'Unit Price',
    totalValue: 'Total Value',
    hsCode: 'HS Code',
    weight: 'Weight',
    cbm: 'Pallet Qty',
    estimatedShipDate: 'Ship Date',
    estimatedArrival: 'ETA',
    orderReference: 'Order Ref',
    poNumber: 'PO Number'
  }
};