import * as XLSX from 'xlsx';
import { Shipment, ShipmentStatus } from '../types/shipment';
import { getWeekStartDate, getWeekNumber } from './dateUtils';

export class ExcelProcessor {
  // ---- helpers -------------------------------------------------------------
  static _normHeader(s) {
    return String(s ?? '')
      .toLowerCase()
      .replace(/\u00B3/g, '3')  // m³ -> m3
      .replace(/\s+/g, ' ')
      .trim();
  }
  static _detectPalletQtyHeader(headers) {
    const H = headers || [];
    const n = (s) => this._normHeader(s);
    const aliases = ['pallet qty','pallet quantity','pallets','pallet','pallet count'];

    // exact / alias match
    for (let i = 0; i < H.length; i++) {
      if (aliases.includes(n(H[i]))) return H[i];
    }
    // fallback: next column after QUANTITY
    const qtyAliases = ['quantity','qty','units','pcs'];
    const qIdx = H.findIndex(h => qtyAliases.includes(n(h)));
    if (qIdx >= 0 && H[qIdx + 1] !== undefined) return H[qIdx + 1];

    return null;
  }
  static parseWeekNumber(weekValue) {
    if (!weekValue && weekValue !== 0) return null;
    if (typeof weekValue === 'number') return weekValue;
    const valueStr = weekValue.toString();
    if (/-/.test(valueStr)) {
      const d = new Date(valueStr);
      if (!isNaN(d.getTime())) {
        const y0 = new Date(d.getFullYear(), 0, 1);
        return Math.ceil((((d - y0) / 86400000) + y0.getDay() + 1) / 7);
      }
    }
    const weekNum = parseInt(valueStr.replace(/\D/g, ''), 10);
    return isNaN(weekNum) ? null : weekNum;
  }
  // robust: "1 234,56" -> 1234.56 ; "2,5" -> 2.5 ; "1,234.56" -> 1234.56
  static parseQuantity(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    let s = String(v).trim().replace(/\s+/g, '');
    if (s.includes('.') && s.includes(',')) s = s.replace(/,/g, '');
    else if (!s.includes('.') && s.includes(',')) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  static extractProductName(orderRefValue) {
    if (!orderRefValue) return '';
    const parts = orderRefValue.toString().split(' / ');
    return parts[0].trim();
  }
  static mapStatus(statusValue) {
    if (!statusValue) return ShipmentStatus.PLANNED_AIRFREIGHT;
    const s = statusValue.toString().toLowerCase().replace(/_/g, ' ').trim();

    // Exact matches first
    if (s === 'in transit seaway' || s === 'in transit sea') return ShipmentStatus.IN_TRANSIT_SEAWAY;
    if (s === 'in transit roadway' || s === 'in transit road') return ShipmentStatus.IN_TRANSIT_ROADWAY;
    if (s === 'in transit airfreight' || s === 'in transit air') return ShipmentStatus.IN_TRANSIT_AIRFREIGHT;
    if (s === 'planned seafreight' || s === 'planned sea') return ShipmentStatus.PLANNED_SEAFREIGHT;
    if (s === 'planned airfreight' || s === 'planned air') return ShipmentStatus.PLANNED_AIRFREIGHT;

    // Pattern matches
    if (s.includes('seaway') || s.includes('sea transit') || s.includes('maritime')) return ShipmentStatus.IN_TRANSIT_SEAWAY;
    if (s.includes('roadway') || s.includes('road transit')) return ShipmentStatus.IN_TRANSIT_ROADWAY;
    if (s.includes('airfreight') || s.includes('air transit')) return ShipmentStatus.IN_TRANSIT_AIRFREIGHT;
    if (s.includes('moored')) return ShipmentStatus.MOORED;
    if (s.includes('berth working')) return ShipmentStatus.BERTH_WORKING;
    if (s.includes('berth complete')) return ShipmentStatus.BERTH_COMPLETE;
    if (s.includes('arrived pta') || s.includes('pta')) return ShipmentStatus.ARRIVED_PTA;
    if (s.includes('arrived klm') || s.includes('klm')) return ShipmentStatus.ARRIVED_KLM;
    if (s.includes('arrived') || s.includes('delivered')) return ShipmentStatus.ARRIVED_PTA;
    if (s.includes('delay')) return ShipmentStatus.DELAYED;
    if (s.includes('cancel')) return ShipmentStatus.CANCELLED;

    return ShipmentStatus.PLANNED_AIRFREIGHT;
  }

  static calculateWeekDate(weekNumber) {
    if (!weekNumber || weekNumber < 1 || weekNumber > 53) return null;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentWeek = getWeekNumber(now);
    const currentMonth = now.getMonth(); // 0-11

    // Smart year detection:
    // If we're in December (month 11) and importing week 1-10, assume next year
    // If we're in January (month 0) and importing week 45-53, assume last year
    let targetYear = currentYear;

    if (currentMonth === 11 && weekNumber <= 10) {
      targetYear = currentYear + 1;
    } else if (currentMonth === 0 && weekNumber >= 45) {
      targetYear = currentYear - 1;
    } else if (weekNumber < currentWeek - 20) {
      // If week is more than 20 weeks behind current, it's probably next year
      targetYear = currentYear + 1;
    } else if (weekNumber > currentWeek + 20) {
      // If week is more than 20 weeks ahead of current, it's probably last year
      targetYear = currentYear - 1;
    }

    const weekStartDate = getWeekStartDate(weekNumber, targetYear);
    return weekStartDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  }

  // ---- main ---------------------------------------------------------------
  static parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      console.log('ExcelProcessor v2.2 – parsing:', file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          const headers = aoa[0] || [];
          const rows = aoa.slice(1);
          console.log('Headers:', headers);

          const formatted = rows.map((row) => {
            const o = {};
            headers.forEach((h, i) => { o[h] = row[i]; });
            return o;
          });

          const palletQtyHeader = this._detectPalletQtyHeader(headers);
          console.log('Detected Pallet Qty header:', palletQtyHeader ?? '(none, using fallback)');

          const shipments = this.convertToShipments(formatted, palletQtyHeader);
          console.log('Converted shipments:', shipments.length);
          resolve(shipments);
        } catch (err) {
          console.error('ExcelProcessor: Error', err);
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  static convertToShipments(data, palletQtyHeader) {
    return (data || []).map((row, index) => {
      const palletQtyRaw =
        (palletQtyHeader ? row[palletQtyHeader] : undefined) ??
        row['PALLET QTY'] ?? row['Pallet Qty'] ?? row['PALLETS'] ?? row['Pallet'] ?? row['Pallet Quantity'] ?? row['pallet qty'] ?? row['pallets'];
      const palletQtyValue = this.parseQuantity(palletQtyRaw);

      if (index < 3) {
        console.log(`Row ${index} Pallet Qty: header="${palletQtyHeader}", raw="${palletQtyRaw}", parsed=${palletQtyValue}`);
      }

      const weekNumber = this.parseWeekNumber(row['WEEK NUMBER'] || row['Week Number']);
      const selectedWeekDate = this.calculateWeekDate(weekNumber);

      return new Shipment({
        id: `ship_${Date.now()}_${index}`,
        supplier: row['SUPPLIER'] || row['Supplier'] || '',
        orderRef: row['ORDER/REF'] || row['Order/Ref'] || `ORD-${index + 1}`,
        finalPod: row['FINAL POD'] || row['Final POD'] || '',
        latestStatus: this.mapStatus(row['LATEST STATUS'] || row['Latest Status']),
        weekNumber: weekNumber,
        selectedWeekDate: selectedWeekDate,
        productName: (row['PRODUCT NAME'] || row['Product Name'] || this.extractProductName(row['ORDER/REF'] || row['Order/Ref'] || '')),
        quantity: this.parseQuantity(row['QUANTITY'] || row['Quantity'] || row['Qty']),
        palletQty: palletQtyValue,
        receivingWarehouse: row['RECEIVING WAREHOUSE'] || row['Receiving Warehouse'] || row['WAREHOUSE'] || row['Warehouse'] || row['FINAL POD'] || row['Final POD'] || '',
        forwardingAgent: row['FORWARDING AGENT'] || row['Forwarding Agent'] || '',
        vesselName: row['VESSEL NAME'] || row['Vessel Name'] || '',
        incoterm: row['INCOTERM'] || row['Incoterm'] || '',
        notes: row['NOTES'] || row['Notes'] || row['COMMENTS'] || row['Comments'] || '',
      });
    });
  }

  static exportToExcel(shipments, filename = 'shipment_schedule.xlsx') {
    const ws = XLSX.utils.json_to_sheet(
      shipments.map(s => ({
        'SUPPLIER': s.supplier,
        'ORDER/REF': s.orderRef,
        'FINAL POD': s.finalPod,
        'LATEST STATUS': s.latestStatus,
        'WEEK NUMBER': s.weekNumber,
        'PRODUCT NAME': s.productName,
        'QUANTITY': s.quantity,
        'RECEIVING WAREHOUSE': s.receivingWarehouse,
        'FORWARDING AGENT': s.forwardingAgent,
        'PALLET QTY': s.palletQty,
        'NOTES': s.notes,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shipment Schedule');
    XLSX.writeFile(wb, filename);
  }

  static downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([{
      'SUPPLIER': 'Example Supplier Ltd',
      'ORDER/REF': 'Disodium Phosphate Anhydrous / APO0016424',
      'FINAL POD': 'PRETORIA',
      'LATEST STATUS': 'planned_airfreight',
      'WEEK NUMBER': 36,
      'PRODUCT NAME': 'Disodium Phosphate Anhydrous',
      'QUANTITY': 1000,
      'PALLET QTY': 4,
      'RECEIVING WAREHOUSE': 'PRETORIA',
      'FORWARDING AGENT': 'DHL Express',
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TRACKING');
    XLSX.writeFile(wb, 'shipment_template.xlsx');
  }
}
