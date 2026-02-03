import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getApiUrl } from '../config/api';
import { authFetch } from '../utils/authFetch';
import {
  calculateAllTotals,
  formatCurrency,
  formatNumber,
  CONTAINER_TYPES,
  INCO_TERMS,
  SA_PORTS,
} from '../utils/costingCalculations';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Payment terms options
const PAYMENT_TERMS = [
  { value: 'CIA', label: 'CIA - Cash in Advance' },
  { value: 'COD', label: 'COD - Cash on Delivery' },
  { value: 'Net 7', label: 'Net 7 Days' },
  { value: 'Net 14', label: 'Net 14 Days' },
  { value: 'Net 30', label: 'Net 30 Days' },
  { value: 'Net 45', label: 'Net 45 Days' },
  { value: 'Net 60', label: 'Net 60 Days' },
  { value: 'Net 90', label: 'Net 90 Days' },
  { value: '2/10 Net 30', label: '2/10 Net 30 - 2% discount if paid in 10 days' },
  { value: 'LC at Sight', label: 'LC at Sight - Letter of Credit' },
  { value: 'LC 30 Days', label: 'LC 30 Days - Letter of Credit' },
  { value: 'LC 60 Days', label: 'LC 60 Days - Letter of Credit' },
  { value: 'LC 90 Days', label: 'LC 90 Days - Letter of Credit' },
  { value: 'DA 30', label: 'DA 30 - Documents Against Acceptance' },
  { value: 'DA 60', label: 'DA 60 - Documents Against Acceptance' },
  { value: 'DA 90', label: 'DA 90 - Documents Against Acceptance' },
  { value: 'DP', label: 'DP - Documents Against Payment' },
  { value: 'TT in Advance', label: 'TT in Advance - Telegraphic Transfer' },
  { value: 'TT after Delivery', label: 'TT after Delivery' },
];

const INITIAL_FORM_STATE = {
  reference_number: '',
  // Origin details
  country_of_origin: '',
  port_of_loading: '',
  // Destination details
  country_of_destination: 'South Africa',
  port_of_discharge: 'CPT',
  shipping_line: '',
  routing: '',
  frequency: '',
  transit_time_days: 30,
  inco_terms: 'CIF',
  inco_term_place: 'CPT',
  container_type: "20' Dry Container",
  quantity: 1,
  supplier_name: '',
  validity_date: '',
  costing_date: new Date().toISOString().split('T')[0],
  payment_terms: '',
  roe_origin: '',  // USD/ZAR
  roe_eur: '',     // EUR/ZAR
  // Ocean Freight
  ocean_freight_usd: 0,
  ocean_freight_eur: 0,
  // Origin Charges
  origin_charge_usd: 0,
  origin_charge_eur: 0,
  // Local Charges (Transport/Cartage) - Default rates from AFI rate sheet
  local_cartage_cpt_klapmuts_20ton_zar: 6970,
  local_cartage_cpt_klapmuts_28ton_zar: 7500,
  transport_dbn_to_pretoria_20ft_zar: 16640,
  transport_dbn_to_pretoria_40ft_zar: 20380,
  transport_dbn_to_whs_zar: 5350,
  unpack_reload_zar: 5430,
  storage_zar: 15,
  storage_days: 0,
  outlying_depot_surcharge_zar: 964,
  local_cartage_dbn_whs_pretoria_opt_a_zar: 17000,
  local_cartage_dbn_whs_pretoria_opt_b_zar: 19260,
  local_cartage_dbn_whs_pretoria_6m_zar: 10370,
  local_cartage_dbn_whs_pretoria_12m_zar: 14330,
  transport_pe_coega_to_pretoria_zar: 0,
  // Destination Charges (Port/Shipping) - Default rates from AFI rate sheet
  shipping_line_charges_zar: 0,
  cargo_dues_20ft_zar: 1879.72,
  cargo_dues_40ft_zar: 3759.42,
  cto_fee_zar: 360,
  port_health_inspection_zar: 620,
  daff_inspection_zar: 620,
  state_vet_cancellation_fee_zar: 290,
  jnb_turn_in_zar: 0,
  // Products - each product in the container
  products: [
    { name: '', hs_code: '', pack_size: '', pack_type: '', weight_kg: 0, rate_per_kg: 0, duty_percent: 0, duty_schedule1_percent: 0, currency: 'USD', invoice_value: 0 }
  ],
  // Customs & Duties
  roe_customs: '',  // ROE for customs calculation
  customs_declaration_zar: 590,
  agency_fee_percentage: 3.5,
  agency_fee_min: 1187,
  // Metadata
  notes: '',
  status: 'draft',
};

function ImportCosting() {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [editingId, setEditingId] = useState(null);
  const [calculatedTotals, setCalculatedTotals] = useState({});
  const [exchangeRate, setExchangeRate] = useState(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [error, setError] = useState(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailEstimate, setEmailEstimate] = useState(null);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'
  const [showReports, setShowReports] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const chartRef = useRef(null);

  // Get unique products from estimates - filtered by selected supplier
  const allProducts = useMemo(() => {
    const productSet = new Set();
    estimates.forEach(est => {
      // Only include products from the selected supplier (or all if 'all' is selected)
      if (selectedSupplier !== 'all' && est.supplier_name !== selectedSupplier) return;
      (est.products || []).forEach(p => {
        if (p.name) productSet.add(p.name);
      });
    });
    return Array.from(productSet).sort();
  }, [estimates, selectedSupplier]);

  // Get unique suppliers from all estimates
  const allSuppliers = useMemo(() => {
    const supplierSet = new Set();
    estimates.forEach(est => {
      if (est.supplier_name) supplierSet.add(est.supplier_name);
    });
    return Array.from(supplierSet).sort();
  }, [estimates]);

  // Get chart data - costs per supplier filtered by product and supplier
  const getSupplierChartData = useMemo(() => {
    const supplierData = {};

    estimates.forEach(est => {
      const supplier = est.supplier_name || 'Unknown';
      const products = est.products || [];

      // Filter by selected supplier if not 'all'
      if (selectedSupplier !== 'all' && supplier !== selectedSupplier) return;

      // Filter by selected product if not 'all'
      const relevantProducts = selectedProduct === 'all'
        ? products
        : products.filter(p => p.name === selectedProduct);

      if (relevantProducts.length === 0 && selectedProduct !== 'all') return;

      if (!supplierData[supplier]) {
        supplierData[supplier] = {
          totalCost: 0,
          totalWeight: 0,
          costPerKg: 0,
          estimateCount: 0,
          totalInvoiceValue: 0,
        };
      }

      const totals = calculateAllTotals(est);
      const productWeight = relevantProducts.reduce((sum, p) => sum + (parseFloat(p.weight_kg) || 0), 0);
      const productValue = relevantProducts.reduce((sum, p) => sum + (parseFloat(p.invoice_value) || 0), 0);
      const totalWeight = (est.products || []).reduce((sum, p) => sum + (parseFloat(p.weight_kg) || 0), 0);

      // If filtering by product, calculate proportional cost
      const weightRatio = totalWeight > 0 && selectedProduct !== 'all'
        ? productWeight / totalWeight
        : 1;

      supplierData[supplier].totalCost += (totals.total_in_warehouse_cost_zar || 0) * weightRatio;
      supplierData[supplier].totalWeight += productWeight || totalWeight;
      supplierData[supplier].totalInvoiceValue += productValue;
      supplierData[supplier].estimateCount += 1;
    });

    // Calculate cost per kg
    Object.keys(supplierData).forEach(supplier => {
      const data = supplierData[supplier];
      data.costPerKg = data.totalWeight > 0 ? data.totalCost / data.totalWeight : 0;
    });

    // Sort by total cost descending
    const sortedSuppliers = Object.entries(supplierData)
      .sort(([,a], [,b]) => b.totalCost - a.totalCost);

    return {
      labels: sortedSuppliers.map(([name]) => name),
      datasets: [
        {
          label: 'Total Cost (ZAR)',
          data: sortedSuppliers.map(([,data]) => data.totalCost),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2,
          borderRadius: 4,
          yAxisID: 'y',
        },
        {
          label: 'Cost per KG (ZAR)',
          data: sortedSuppliers.map(([,data]) => data.costPerKg),
          backgroundColor: 'rgba(245, 158, 11, 0.8)',
          borderColor: 'rgb(245, 158, 11)',
          borderWidth: 2,
          borderRadius: 4,
          yAxisID: 'y1',
        }
      ],
      supplierDetails: sortedSuppliers.map(([name, data]) => ({ name, ...data })),
    };
  }, [estimates, selectedProduct]);

  // Filter and sort estimates (exclude archived - those show under Suppliers)
  const filteredEstimates = estimates
    .filter(est => {
      // Exclude archived estimates from main view
      if (est.status === 'archived') return false;
      if (!searchTerm) return true;
      const ref = (est.reference_number || '').toLowerCase();
      const supplier = (est.supplier_name || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      return ref.includes(search) || supplier.includes(search);
    })
    .sort((a, b) => {
      const refA = (a.reference_number || '').toLowerCase();
      const refB = (b.reference_number || '').toLowerCase();
      if (sortDirection === 'asc') {
        return refA.localeCompare(refB);
      }
      return refB.localeCompare(refA);
    });

  // Fetch estimates on mount
  useEffect(() => {
    fetchEstimates();
    fetchExchangeRate();
    fetchSuppliers();
  }, []);

  // Recalculate totals when form data changes
  useEffect(() => {
    const totals = calculateAllTotals(formData);
    setCalculatedTotals(totals);
  }, [formData]);

  const fetchEstimates = async () => {
    try {
      setLoading(true);
      const response = await authFetch(getApiUrl('/api/costing'));
      if (response.ok) {
        const result = await response.json();
        setEstimates(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch estimates:', err);
      setError('Failed to load cost estimates');
    } finally {
      setLoading(false);
    }
  };

  const fetchExchangeRate = async () => {
    try {
      setRateLoading(true);
      const response = await authFetch(getApiUrl('/api/costing/exchange-rate/current'));
      if (response.ok) {
        const result = await response.json();
        setExchangeRate(result.data);
        if (result.data?.rate && !formData.roe_origin) {
          setFormData(prev => ({ ...prev, roe_origin: result.data.rate }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch exchange rate:', err);
    } finally {
      setRateLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await authFetch(getApiUrl('/api/suppliers'));
      if (response.ok) {
        const result = await response.json();
        setSuppliers(result.data || result || []);
      }
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  };

  const createSupplier = async () => {
    if (!newSupplierName.trim()) return;
    try {
      const response = await authFetch(getApiUrl('/api/suppliers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSupplierName.trim() }),
      });
      if (response.ok) {
        const result = await response.json();
        const newSupplier = result.data || result;
        // Add to suppliers list and select it
        setSuppliers(prev => [...prev, newSupplier]);
        setFormData(prev => ({ ...prev, supplier_name: newSupplier.name }));
        setShowAddSupplier(false);
        setNewSupplierName('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create supplier');
      }
    } catch (err) {
      console.error('Failed to create supplier:', err);
      setError('Failed to create supplier');
    }
  };

  const refreshExchangeRate = async () => {
    try {
      setRateLoading(true);
      const response = await authFetch(getApiUrl('/api/costing/exchange-rate/refresh'), {
        method: 'POST',
      });
      if (response.ok) {
        const result = await response.json();
        setExchangeRate(result.data);
        setFormData(prev => ({ ...prev, roe_origin: result.data.rate }));
      }
    } catch (err) {
      console.error('Failed to refresh exchange rate:', err);
    } finally {
      setRateLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Product helpers
  const addProduct = () => {
    setFormData(prev => ({
      ...prev,
      products: [
        ...prev.products,
        { name: '', hs_code: '', pack_size: '', pack_type: '', weight_kg: 0, rate_per_kg: 0, duty_percent: 0, duty_schedule1_percent: 0, currency: 'USD', invoice_value: 0 }
      ]
    }));
  };

  const removeProduct = (index) => {
    setFormData(prev => {
      const newProducts = prev.products.filter((_, i) => i !== index);
      const totals = calculateProductTotals(newProducts);
      return {
        ...prev,
        products: newProducts,
        origin_charge_usd: totals.totalUSD,
        origin_charge_eur: totals.totalEUR,
      };
    });
  };

  // Calculate totals by currency from products
  const calculateProductTotals = (products) => {
    let totalUSD = 0;
    let totalEUR = 0;
    let totalZAR = 0;

    (products || []).forEach(p => {
      const invoiceValue = parseFloat(p.invoice_value) || 0;
      const currency = p.currency || 'USD';
      if (currency === 'USD') totalUSD += invoiceValue;
      else if (currency === 'EUR') totalEUR += invoiceValue;
      else if (currency === 'ZAR') totalZAR += invoiceValue;
    });

    return { totalUSD, totalEUR, totalZAR };
  };

  const updateProduct = (index, field, value) => {
    setFormData(prev => {
      const newProducts = prev.products.map((item, i) => {
        if (i !== index) return item;

        const updatedItem = { ...item, [field]: value };

        // Auto-calculate invoice_value when weight or rate_per_kg changes
        if (field === 'weight_kg' || field === 'rate_per_kg') {
          const weight = field === 'weight_kg' ? (parseFloat(value) || 0) : (parseFloat(item.weight_kg) || 0);
          const rate = field === 'rate_per_kg' ? (parseFloat(value) || 0) : (parseFloat(item.rate_per_kg) || 0);
          updatedItem.invoice_value = Math.round(weight * rate * 100) / 100;
        }

        return updatedItem;
      });

      // Calculate totals and update origin charges
      const totals = calculateProductTotals(newProducts);

      return {
        ...prev,
        products: newProducts,
        origin_charge_usd: totals.totalUSD,
        origin_charge_eur: totals.totalEUR,
      };
    });
  };

  // Calculate total weight from all products
  const getTotalWeight = () => {
    return (formData.products || []).reduce((sum, p) => sum + (parseFloat(p.weight_kg) || 0), 0);
  };

  // Calculate product customs values
  const calculateProductCustomsValues = (product) => {
    const roeCustoms = parseFloat(formData.roe_customs) || parseFloat(formData.roe_origin) || 0;
    const roeEur = parseFloat(formData.roe_eur) || roeCustoms;
    const invoiceValue = parseFloat(product.invoice_value) || 0;
    const dutyPercent = parseFloat(product.duty_percent) || 0;
    const dutySchedule1Percent = parseFloat(product.duty_schedule1_percent) || 0;
    const currency = product.currency || 'USD';

    // Convert to ZAR based on currency
    let roe = roeCustoms;
    if (currency === 'EUR') roe = roeEur;
    if (currency === 'ZAR') roe = 1;

    const customsValue = invoiceValue * roe;
    const totalDuties = customsValue * (dutyPercent / 100);
    const schedule1Duty = customsValue * (dutySchedule1Percent / 100);
    const totalVat = (customsValue + totalDuties + schedule1Duty) * 0.15;

    return { customsValue, totalDuties, schedule1Duty, totalVat, roe };
  };

  // Calculate product cost allocation (shipping costs allocated by weight)
  const calculateProductAllocation = (product) => {
    const totalWeight = getTotalWeight();
    const productWeight = parseFloat(product.weight_kg) || 0;
    const weightRatio = totalWeight > 0 ? productWeight / totalWeight : 0;

    // Get shipping costs from calculated totals
    const totalShippingCost = calculatedTotals.total_shipping_cost_zar || 0;
    const allocatedShippingCost = totalShippingCost * weightRatio;

    // Get customs values for this product
    const customs = calculateProductCustomsValues(product);
    // VAT excluded - not charged to clients
    const productCustomsCost = customs.totalDuties + customs.schedule1Duty;

    // Total cost for this product
    const totalProductCost = allocatedShippingCost + productCustomsCost;
    const costPerKg = productWeight > 0 ? totalProductCost / productWeight : 0;

    return { weightRatio, allocatedShippingCost, productCustomsCost, totalProductCost, costPerKg };
  };

  // Calculate customs totals from all products
  const getCustomsTotals = () => {
    let totalCustomsValue = 0;
    let totalDuties = 0;
    let totalSchedule1Duty = 0;
    let totalVat = 0;

    (formData.products || []).forEach(product => {
      const values = calculateProductCustomsValues(product);
      totalCustomsValue += values.customsValue;
      totalDuties += values.totalDuties;
      totalSchedule1Duty += values.schedule1Duty;
      totalVat += values.totalVat;
    });

    return { totalCustomsValue, totalDuties, totalSchedule1Duty, totalVat };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Clean data - convert empty strings to null for numeric fields
      const cleanedData = { ...formData };
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key] === '') {
          cleanedData[key] = null;
        }
      });
      // Filter out display-only fields (prefixed with underscore)
      const dbTotals = {};
      Object.keys(calculatedTotals).forEach(key => {
        if (!key.startsWith('_')) {
          dbTotals[key] = calculatedTotals[key];
        }
      });
      const dataToSend = { ...cleanedData, ...dbTotals };
      console.log('Submitting costing data:', dataToSend);

      const url = editingId
        ? getApiUrl(`/api/costing/${editingId}`)
        : getApiUrl('/api/costing');

      const response = await authFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        setShowForm(false);
        setEditingId(null);
        setFormData(INITIAL_FORM_STATE);
        fetchEstimates();
      } else {
        const errorData = await response.json();
        console.error('Save error details:', errorData);
        let detailMsg = '';
        if (Array.isArray(errorData.details)) {
          detailMsg = errorData.details.map(d => `${d.path || d.param}: ${d.msg || d.message}`).join(', ');
        } else if (typeof errorData.details === 'string') {
          detailMsg = errorData.details;
        }
        setError(detailMsg || errorData.error || errorData.message || 'Failed to save cost estimate');
      }
    } catch (err) {
      console.error('Failed to save estimate:', err);
      setError('Failed to save cost estimate');
    }
  };

  const handleEdit = (estimate) => {
    setFormData({
      ...INITIAL_FORM_STATE,
      ...estimate,
    });
    setEditingId(estimate.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this cost estimate?')) return;

    try {
      const response = await authFetch(getApiUrl(`/api/costing/${id}`), {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchEstimates();
      }
    } catch (err) {
      console.error('Failed to delete estimate:', err);
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const response = await authFetch(getApiUrl(`/api/costing/${id}/duplicate`), {
        method: 'POST',
      });
      if (response.ok) {
        fetchEstimates();
      }
    } catch (err) {
      console.error('Failed to duplicate estimate:', err);
    }
  };

  const generatePDF = (estimate) => {
    const doc = new jsPDF();
    const totals = calculateAllTotals(estimate);
    const products = estimate.products || [];

    // Helper to filter out zero values
    const filterZeroRows = (rows) => rows.filter(row => {
      const value = row[row.length - 1];
      if (typeof value === 'string') {
        const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
        return !isNaN(numericValue) && numericValue !== 0;
      }
      return value !== 0 && value !== '-';
    });

    // Calculate product totals for PDF
    const getProductTotals = () => {
      const roeCustoms = parseFloat(estimate.roe_customs) || parseFloat(estimate.roe_origin) || 0;
      const roeEur = parseFloat(estimate.roe_eur) || roeCustoms;
      let totalWeight = 0;
      let totalCustomsValue = 0;
      let totalDuties = 0;

      products.forEach(p => {
        const weight = parseFloat(p.weight_kg) || 0;
        const invoiceValue = parseFloat(p.invoice_value) || 0;
        const dutyPercent = parseFloat(p.duty_percent) || 0;
        const dutySchedule1Percent = parseFloat(p.duty_schedule1_percent) || 0;
        const currency = p.currency || 'USD';

        let roe = roeCustoms;
        if (currency === 'EUR') roe = roeEur;
        if (currency === 'ZAR') roe = 1;

        const customsValue = invoiceValue * roe;
        const duties = customsValue * ((dutyPercent + dutySchedule1Percent) / 100);

        totalWeight += weight;
        totalCustomsValue += customsValue;
        totalDuties += duties;
      });

      return { totalWeight, totalCustomsValue, totalDuties };
    };

    const productTotals = getProductTotals();

    // Header
    doc.setFontSize(18);
    doc.setTextColor(11, 31, 58);
    doc.text('FCL Import Cost Estimate', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Reference: ${estimate.reference_number || 'N/A'}`, 14, 28);
    doc.text(`Date: ${estimate.costing_date || 'N/A'}`, 14, 34);
    doc.text(`Supplier: ${estimate.supplier_name || 'N/A'}`, 14, 40);

    // ROE Information - always shown prominently
    doc.setFontSize(9);
    doc.setTextColor(0, 102, 204);
    doc.setFont(undefined, 'bold');
    const roeDate = estimate.costing_date || new Date().toISOString().split('T')[0];
    doc.text(`ROE Date: ${roeDate}`, 130, 28);
    doc.text(`USD/ZAR: ${formatNumber(estimate.roe_origin || 0, 4)}`, 130, 34);
    doc.text(`EUR/ZAR: ${formatNumber(estimate.roe_eur || 0, 4)}`, 130, 40);
    doc.setFont(undefined, 'normal');

    // Shipment Details
    const shipmentRows = filterZeroRows([
      ['Country of Origin', estimate.country_of_origin || '-'],
      ['Port of Loading', estimate.port_of_loading || '-'],
      ['Port of Discharge', estimate.port_of_discharge || '-'],
      ['Container Type', estimate.container_type || '-'],
      ['INCO Terms', estimate.inco_terms || '-'],
      ['Transit Time', estimate.transit_time_days ? `${estimate.transit_time_days} days` : '-'],
      ['Total Weight', `${formatNumber(productTotals.totalWeight || estimate.total_gross_weight_kg)} kg`],
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['Shipment Details', '']],
      body: shipmentRows,
      theme: 'grid',
      headStyles: { fillColor: [11, 31, 58] },
    });

    // Products in Container (if any)
    if (products.length > 0) {
      const roeCustoms = parseFloat(estimate.roe_customs) || parseFloat(estimate.roe_origin) || 0;
      const roeEur = parseFloat(estimate.roe_eur) || roeCustoms;

      const productRows = products.map(p => {
        const weight = parseFloat(p.weight_kg) || 0;
        const ratePerKg = parseFloat(p.rate_per_kg) || 0;
        const invoiceValue = parseFloat(p.invoice_value) || 0;
        const dutyPercent = parseFloat(p.duty_percent) || 0;
        const dutySchedule1Percent = parseFloat(p.duty_schedule1_percent) || 0;
        const currency = p.currency || 'USD';

        let roe = roeCustoms;
        if (currency === 'EUR') roe = roeEur;
        if (currency === 'ZAR') roe = 1;

        const customsValue = invoiceValue * roe;
        const duties = customsValue * ((dutyPercent + dutySchedule1Percent) / 100);
        const weightPercent = productTotals.totalWeight > 0 ? (weight / productTotals.totalWeight * 100) : 0;

        return [
          p.name || '-',
          p.hs_code || '-',
          p.pack_size || '-',
          p.pack_type || '-',
          `${formatNumber(weight)} kg`,
          `${formatNumber(ratePerKg, 2)}`,
          currency,
          formatNumber(invoiceValue, 2),
          `${formatNumber(weightPercent, 1)}%`,
          formatCurrency(duties),
        ];
      });

      // Add totals row
      productRows.push([
        'TOTAL',
        '',
        '',
        '',
        `${formatNumber(productTotals.totalWeight)} kg`,
        '',
        '',
        '',
        '100%',
        formatCurrency(productTotals.totalDuties),
      ]);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Product', 'HS Code', 'Pack Size', 'Pack Type', 'Weight', 'Rate/kg', 'Curr', 'Invoice Val', 'Share', 'Duties']],
        body: productRows,
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11] },
        styles: { fontSize: 8 },
      });
    }

    // Ocean Freight - filter zero values
    const oceanFreightRows = filterZeroRows([
      ['Ocean Freight (USD)', formatCurrency(estimate.ocean_freight_usd, 'USD'), formatCurrency(totals._ocean_freight_usd_zar)],
      ['Ocean Freight (EUR)', formatCurrency(estimate.ocean_freight_eur, 'EUR'), formatCurrency(totals._ocean_freight_eur_zar)],
    ]);
    if (totals.total_ocean_freight_zar > 0) {
      oceanFreightRows.push(['Total Ocean Freight', '', formatCurrency(totals.total_ocean_freight_zar)]);
    }

    if (oceanFreightRows.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Ocean Freight', 'Amount', 'ZAR']],
        body: oceanFreightRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    // Origin Charges - filter zero values
    const originRows = filterZeroRows([
      ['Origin Charge (USD)', formatCurrency(estimate.origin_charge_usd, 'USD'), formatCurrency(totals._origin_charge_usd_zar)],
      ['Origin Charge (EUR)', formatCurrency(estimate.origin_charge_eur, 'EUR'), formatCurrency(totals._origin_charge_eur_zar)],
    ]);
    if (totals.total_origin_charges_zar > 0) {
      originRows.push(['Total Origin Charges', '', formatCurrency(totals.total_origin_charges_zar)]);
    }

    if (originRows.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Origin Charges', 'Amount', 'ZAR']],
        body: originRows,
        theme: 'grid',
        headStyles: { fillColor: [46, 139, 87] },
      });
    }

    // Local Charges - filter zero values
    const localChargeRows = filterZeroRows([
      ['Local Cartage: CPT to Klapmuts (<20 Ton)', formatCurrency(estimate.local_cartage_cpt_klapmuts_20ton_zar)],
      ['Local Cartage: CPT to Klapmuts (21-28 Ton)', formatCurrency(estimate.local_cartage_cpt_klapmuts_28ton_zar)],
      ['Transport: DBN Port to Pretoria (20FT)', formatCurrency(estimate.transport_dbn_to_pretoria_20ft_zar)],
      ['Transport: DBN Port to Pretoria (40FT)', formatCurrency(estimate.transport_dbn_to_pretoria_40ft_zar)],
      ['Transport: DBN Port to WHS', formatCurrency(estimate.transport_dbn_to_whs_zar)],
      ['Unpack / Reload', formatCurrency(estimate.unpack_reload_zar)],
      ['Storage', formatCurrency(estimate.storage_zar)],
      ['Outlying Container Depot Surcharge', formatCurrency(estimate.outlying_depot_surcharge_zar)],
      ['Local Cartage: DBN WHS to PTA (Tautliner A)', formatCurrency(estimate.local_cartage_dbn_whs_pretoria_opt_a_zar)],
      ['Local Cartage: DBN WHS to PTA (Tautliner B)', formatCurrency(estimate.local_cartage_dbn_whs_pretoria_opt_b_zar)],
      ['Local Cartage: DBN WHS to PTA (6M Deck)', formatCurrency(estimate.local_cartage_dbn_whs_pretoria_6m_zar)],
      ['Local Cartage: DBN WHS to PTA (12M Deck)', formatCurrency(estimate.local_cartage_dbn_whs_pretoria_12m_zar)],
      ['Transport: PE/Coega Port to Pretoria', formatCurrency(estimate.transport_pe_coega_to_pretoria_zar)],
    ]);
    if (totals.local_charges_subtotal_zar > 0) {
      localChargeRows.push(['Sub-Total', formatCurrency(totals.local_charges_subtotal_zar)]);
    }

    if (localChargeRows.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Local Charges (Transport/Cartage)', 'ZAR']],
        body: localChargeRows,
        theme: 'grid',
        headStyles: { fillColor: [22, 101, 52] },
      });
    }

    // Destination Charges - filter zero values
    const destChargeRows = filterZeroRows([
      ['Shipping Line Charges (At Cost)', formatCurrency(estimate.shipping_line_charges_zar)],
      ['Cargo Dues (20FT)', formatCurrency(estimate.cargo_dues_20ft_zar)],
      ['Cargo Dues (40FT)', formatCurrency(estimate.cargo_dues_40ft_zar)],
      ['CTO Fee', formatCurrency(estimate.cto_fee_zar)],
      ['Port Health Inspection', formatCurrency(estimate.port_health_inspection_zar)],
      ['DAFF Inspection', formatCurrency(estimate.daff_inspection_zar)],
      ['State Vet Cancellation Fee', formatCurrency(estimate.state_vet_cancellation_fee_zar)],
      ['JNB Turn In (At Cost)', formatCurrency(estimate.jnb_turn_in_zar)],
    ]);
    if (totals.destination_charges_subtotal_zar > 0) {
      destChargeRows.push(['Sub-Total', formatCurrency(totals.destination_charges_subtotal_zar)]);
    }

    if (destChargeRows.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Destination Charges', 'ZAR']],
        body: destChargeRows,
        theme: 'grid',
        headStyles: { fillColor: [0, 123, 167] },
      });
    }

    // Customs & Duties - filter zero values, exclude VAT
    const customsRows = filterZeroRows([
      ['Customs Value (for reference)', formatCurrency(totals.customs_value_zar)],
      ['Duties', formatCurrency(productTotals.totalDuties || estimate.duties_zar)],
      ['Customs Declaration', formatCurrency(estimate.customs_declaration_zar)],
      ['Agency Fee (3.5% min R1187)', formatCurrency(totals.agency_fee_zar)],
    ]);
    if (totals.customs_subtotal_zar > 0) {
      customsRows.push(['Sub-Total (excl. Import VAT)', formatCurrency(totals.customs_subtotal_zar)]);
    }

    if (customsRows.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Customs & Duties', 'ZAR']],
        body: customsRows,
        theme: 'grid',
        headStyles: { fillColor: [146, 64, 14] },
      });
    }

    // Summary Totals - filter zero values
    const summaryRows = filterZeroRows([
      ['Total Shipping Cost', formatCurrency(totals.total_shipping_cost_zar)],
      ['Total in Warehouse Cost', formatCurrency(totals.total_in_warehouse_cost_zar)],
      ['Cost per KG', formatCurrency(totals.all_in_warehouse_cost_per_kg_zar)],
    ]);

    if (summaryRows.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Summary', 'Amount']],
        body: summaryRows,
        theme: 'grid',
        headStyles: { fillColor: [11, 31, 58] },
        bodyStyles: { fontStyle: 'bold' },
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Generated by Synercore Import Schedule', 14, doc.internal.pageSize.height - 10);

    doc.save(`cost-estimate-${estimate.reference_number || estimate.id}.pdf`);
  };

  // Generate PDF as base64 for email attachment
  const generatePDFBase64 = (estimate) => {
    const doc = new jsPDF();
    const totals = calculateAllTotals(estimate);
    const products = estimate.products || [];

    // Helper to filter out zero values
    const filterZeroRows = (rows) => rows.filter(row => {
      const value = row[row.length - 1];
      if (typeof value === 'string') {
        const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
        return !isNaN(numericValue) && numericValue !== 0;
      }
      return value !== 0 && value !== '-';
    });

    // Calculate product totals for PDF
    const getProductTotals = () => {
      const roeCustoms = parseFloat(estimate.roe_customs) || parseFloat(estimate.roe_origin) || 0;
      const roeEur = parseFloat(estimate.roe_eur) || roeCustoms;
      let totalWeight = 0;
      let totalCustomsValue = 0;
      let totalDuties = 0;

      products.forEach(p => {
        const weight = parseFloat(p.weight_kg) || 0;
        const invoiceValue = parseFloat(p.invoice_value) || 0;
        const dutyPercent = parseFloat(p.duty_percent) || 0;
        const dutySchedule1Percent = parseFloat(p.duty_schedule1_percent) || 0;
        const currency = p.currency || 'USD';

        let roe = roeCustoms;
        if (currency === 'EUR') roe = roeEur;
        if (currency === 'ZAR') roe = 1;

        const customsValue = invoiceValue * roe;
        const duties = customsValue * ((dutyPercent + dutySchedule1Percent) / 100);

        totalWeight += weight;
        totalCustomsValue += customsValue;
        totalDuties += duties;
      });

      return { totalWeight, totalCustomsValue, totalDuties };
    };

    const productTotals = getProductTotals();

    // Header
    doc.setFontSize(18);
    doc.setTextColor(11, 31, 58);
    doc.text('FCL Import Cost Estimate', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Reference: ${estimate.reference_number || 'N/A'}`, 14, 28);
    doc.text(`Date: ${estimate.costing_date || 'N/A'}`, 14, 34);
    doc.text(`Supplier: ${estimate.supplier_name || 'N/A'}`, 14, 40);

    // ROE Information - always shown prominently
    doc.setFontSize(9);
    doc.setTextColor(0, 102, 204);
    doc.setFont(undefined, 'bold');
    const roeDate = estimate.costing_date || new Date().toISOString().split('T')[0];
    doc.text(`ROE Date: ${roeDate}`, 130, 28);
    doc.text(`USD/ZAR: ${formatNumber(estimate.roe_origin || 0, 4)}`, 130, 34);
    doc.text(`EUR/ZAR: ${formatNumber(estimate.roe_eur || 0, 4)}`, 130, 40);
    doc.setFont(undefined, 'normal');

    // Shipment Details
    const shipmentRows = filterZeroRows([
      ['Country of Origin', estimate.country_of_origin || '-'],
      ['Port of Loading', estimate.port_of_loading || '-'],
      ['Port of Discharge', estimate.port_of_discharge || '-'],
      ['Container Type', estimate.container_type || '-'],
      ['INCO Terms', estimate.inco_terms || '-'],
      ['Transit Time', estimate.transit_time_days ? `${estimate.transit_time_days} days` : '-'],
      ['Total Weight', `${formatNumber(productTotals.totalWeight || estimate.total_gross_weight_kg)} kg`],
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['Shipment Details', '']],
      body: shipmentRows,
      theme: 'grid',
      headStyles: { fillColor: [11, 31, 58] },
    });

    // Products in Container (if any)
    if (products.length > 0) {
      const roeCustoms = parseFloat(estimate.roe_customs) || parseFloat(estimate.roe_origin) || 0;
      const roeEur = parseFloat(estimate.roe_eur) || roeCustoms;

      const productRows = products.map(p => {
        const weight = parseFloat(p.weight_kg) || 0;
        const ratePerKg = parseFloat(p.rate_per_kg) || 0;
        const invoiceValue = parseFloat(p.invoice_value) || 0;
        const dutyPercent = parseFloat(p.duty_percent) || 0;
        const dutySchedule1Percent = parseFloat(p.duty_schedule1_percent) || 0;
        const currency = p.currency || 'USD';

        let roe = roeCustoms;
        if (currency === 'EUR') roe = roeEur;
        if (currency === 'ZAR') roe = 1;

        const customsValue = invoiceValue * roe;
        const duties = customsValue * ((dutyPercent + dutySchedule1Percent) / 100);
        const weightPercent = productTotals.totalWeight > 0 ? (weight / productTotals.totalWeight * 100) : 0;

        return [
          p.name || '-',
          p.hs_code || '-',
          p.pack_size || '-',
          p.pack_type || '-',
          `${formatNumber(weight)} kg`,
          `${formatNumber(ratePerKg, 2)}`,
          currency,
          formatNumber(invoiceValue, 2),
          `${formatNumber(weightPercent, 1)}%`,
          formatCurrency(duties),
        ];
      });

      productRows.push([
        'TOTAL', '', '', '', `${formatNumber(productTotals.totalWeight)} kg`, '', '', '', '100%', formatCurrency(productTotals.totalDuties),
      ]);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Product', 'HS Code', 'Pack Size', 'Pack Type', 'Weight', 'Rate/kg', 'Curr', 'Invoice Val', 'Share', 'Duties']],
        body: productRows,
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11] },
        styles: { fontSize: 8 },
      });
    }

    // Summary (simplified for email)
    const summaryRows = filterZeroRows([
      ['Total Shipping Cost', formatCurrency(totals.total_shipping_cost_zar)],
      ['Total in Warehouse Cost', formatCurrency(totals.total_in_warehouse_cost_zar)],
      ['Cost per KG', formatCurrency(totals.all_in_warehouse_cost_per_kg_zar)],
    ]);

    if (summaryRows.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Summary', 'Amount']],
        body: summaryRows,
        theme: 'grid',
        headStyles: { fillColor: [11, 31, 58] },
        bodyStyles: { fontStyle: 'bold' },
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Generated by Synercore Import Schedule', 14, doc.internal.pageSize.height - 10);

    // Return base64 without the data:application/pdf;base64, prefix
    return doc.output('datauristring').split(',')[1];
  };

  // Generate Report PDF with chart and overview
  const generateReportPDF = async () => {
    const doc = new jsPDF();
    const chartData = getSupplierChartData;
    const productLabel = selectedProduct === 'all' ? 'All Products' : selectedProduct;
    const supplierLabel = selectedSupplier === 'all' ? 'All Suppliers' : selectedSupplier;

    // Get average ROE from filtered estimates
    const relevantEstimatesForROE = estimates.filter(est => {
      if (selectedSupplier !== 'all' && est.supplier_name !== selectedSupplier) return false;
      return true;
    });
    const avgRoeOrigin = relevantEstimatesForROE.length > 0
      ? relevantEstimatesForROE.reduce((sum, e) => sum + (parseFloat(e.roe_origin) || 0), 0) / relevantEstimatesForROE.length
      : 0;
    const avgRoeEur = relevantEstimatesForROE.length > 0
      ? relevantEstimatesForROE.reduce((sum, e) => sum + (parseFloat(e.roe_eur) || 0), 0) / relevantEstimatesForROE.length
      : 0;

    // Header
    doc.setFillColor(91, 33, 182);
    doc.rect(0, 0, 220, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('Cost Analysis Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Supplier: ${supplierLabel}`, 14, 25);
    doc.text(`Product: ${productLabel}`, 14, 33);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 41);
    // ROE Information
    doc.setFontSize(9);
    doc.text(`ROE Date: ${new Date().toLocaleDateString()}`, 120, 25);
    doc.text(`USD/ZAR: ${formatNumber(avgRoeOrigin, 4)}`, 120, 33);
    doc.text(`EUR/ZAR: ${formatNumber(avgRoeEur, 4)}`, 120, 41);

    // Try to capture chart as image
    if (chartRef.current) {
      try {
        const chartCanvas = chartRef.current.canvas;
        const chartImage = chartCanvas.toDataURL('image/png', 1.0);
        doc.addImage(chartImage, 'PNG', 14, 57, 180, 80);
      } catch (err) {
        console.error('Error capturing chart:', err);
        doc.setTextColor(100);
        doc.setFontSize(10);
        doc.text('Chart could not be rendered in PDF', 14, 75);
      }
    }

    // Summary Statistics
    const totalEstimates = chartData.supplierDetails.reduce((sum, s) => sum + s.estimateCount, 0);
    const totalWeight = chartData.supplierDetails.reduce((sum, s) => sum + s.totalWeight, 0);
    const totalCost = chartData.supplierDetails.reduce((sum, s) => sum + s.totalCost, 0);
    const avgCostPerKg = totalWeight > 0 ? totalCost / totalWeight : 0;

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text('Summary Statistics', 14, 145);

    autoTable(doc, {
      startY: 151,
      head: [['Metric', 'Value']],
      body: [
        ['Total Suppliers', chartData.labels.length.toString()],
        ['Total Estimates', totalEstimates.toString()],
        ['Total Weight', `${formatNumber(totalWeight)} kg`],
        ['Total Cost', formatCurrency(totalCost)],
        ['Average Cost/KG', formatCurrency(avgCostPerKg)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [91, 33, 182] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
      },
    });

    // Supplier Details Table
    doc.setFontSize(12);
    doc.text('Supplier Cost Breakdown', 14, doc.lastAutoTable.finalY + 15);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Supplier', 'Estimates', 'Weight (kg)', 'Total Cost (ZAR)', 'Cost/KG (ZAR)']],
      body: chartData.supplierDetails.map(s => [
        s.name,
        s.estimateCount.toString(),
        formatNumber(s.totalWeight),
        formatCurrency(s.totalCost),
        formatCurrency(s.costPerKg),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [91, 33, 182] },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
    });

    // Filter estimates by selected product
    // Filter estimates by selected supplier and product
    const relevantEstimates = filteredEstimates.filter(est => {
      // Filter by supplier
      if (selectedSupplier !== 'all' && est.supplier_name !== selectedSupplier) return false;
      // Filter by product
      if (selectedProduct !== 'all') {
        const hasProduct = (est.products || []).some(p => p.name === selectedProduct);
        if (!hasProduct) return false;
      }
      return true;
    });

    // Detailed Estimates with Products (new page for each estimate or grouped)
    doc.addPage();
    doc.setFillColor(91, 33, 182);
    doc.rect(0, 0, 220, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('Complete Estimates with Product Details', 14, 16);

    let currentY = 35;

    relevantEstimates.forEach((est, estIndex) => {
      const totals = calculateAllTotals(est);
      const products = (est.products || []).filter(p =>
        selectedProduct === 'all' || p.name === selectedProduct
      );

      // Check if we need a new page
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      // Estimate Header
      doc.setFillColor(240, 240, 250);
      doc.rect(10, currentY - 5, 190, 28, 'F');
      doc.setDrawColor(91, 33, 182);
      doc.setLineWidth(0.5);
      doc.rect(10, currentY - 5, 190, 28, 'S');

      doc.setTextColor(91, 33, 182);
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(`${estIndex + 1}. ${est.reference_number || est.id.slice(0, 8)}`, 14, currentY + 3);

      doc.setTextColor(60);
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text(`Supplier: ${est.supplier_name || '-'}`, 14, currentY + 11);
      doc.text(`Port: ${est.port_of_discharge || '-'}`, 80, currentY + 11);
      doc.text(`Container: ${est.container_type || '-'}`, 130, currentY + 11);

      doc.setFont(undefined, 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(`Total Cost: ${formatCurrency(totals.total_in_warehouse_cost_zar)}`, 14, currentY + 19);
      doc.setTextColor(217, 119, 6);
      doc.text(`Cost/KG: ${formatCurrency(totals.all_in_warehouse_cost_per_kg_zar)}`, 80, currentY + 19);

      currentY += 32;

      // Products Table for this estimate
      if (products.length > 0) {
        autoTable(doc, {
          startY: currentY,
          head: [['Product Name', 'HS Code', 'Pack Size', 'Pack Type', 'Weight (kg)', 'Rate/kg', 'Currency', 'Invoice Value', 'Duty %', 'Sch1 %']],
          body: products.map(p => [
            p.name || '-',
            p.hs_code || '-',
            p.pack_size || '-',
            p.pack_type || '-',
            formatNumber(p.weight_kg),
            formatNumber(p.rate_per_kg),
            p.currency || 'USD',
            formatNumber(p.invoice_value),
            `${p.duty_percent || 0}%`,
            `${p.duty_schedule1_percent || 0}%`,
          ]),
          theme: 'grid',
          headStyles: { fillColor: [245, 158, 11], fontSize: 7, textColor: [255, 255, 255] },
          styles: { fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 30 },
            4: { halign: 'right' },
            5: { halign: 'right' },
            7: { halign: 'right' },
            8: { halign: 'center' },
            9: { halign: 'center' },
          },
          margin: { left: 14, right: 14 },
        });

        currentY = doc.lastAutoTable.finalY + 15;
      } else {
        doc.setTextColor(150);
        doc.setFontSize(8);
        doc.text('No products in this estimate', 14, currentY + 5);
        currentY += 15;
      }
    });

    // Product Comparison Table (if filtering by specific product)
    if (selectedProduct !== 'all') {
      doc.addPage();
      doc.setFillColor(245, 158, 11);
      doc.rect(0, 0, 220, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text(`Product Comparison: ${selectedProduct}`, 14, 16);

      const productComparison = [];
      relevantEstimates.forEach(est => {
        const totals = calculateAllTotals(est);
        (est.products || [])
          .filter(p => p.name === selectedProduct)
          .forEach(p => {
            productComparison.push([
              est.reference_number || est.id.slice(0, 8),
              est.supplier_name || '-',
              p.hs_code || '-',
              p.pack_size || '-',
              p.pack_type || '-',
              `${formatNumber(p.weight_kg)} kg`,
              `${formatNumber(p.rate_per_kg)} ${p.currency || 'USD'}`,
              `${formatNumber(p.invoice_value)} ${p.currency || 'USD'}`,
              formatCurrency(totals.all_in_warehouse_cost_per_kg_zar),
            ]);
          });
      });

      autoTable(doc, {
        startY: 32,
        head: [['Reference', 'Supplier', 'HS Code', 'Pack Size', 'Pack Type', 'Weight', 'Rate/kg', 'Invoice Value', 'All-in Cost/kg']],
        body: productComparison,
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11], fontSize: 8 },
        styles: { fontSize: 7 },
        columnStyles: {
          8: { halign: 'right', fontStyle: 'bold' },
        },
      });
    }

    // Footer on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount} | Generated by Synercore Import Schedule`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    const fileSupplier = supplierLabel.replace(/\s+/g, '-').toLowerCase();
    const fileProduct = productLabel.replace(/\s+/g, '-').toLowerCase();
    doc.save(`cost-report-${fileSupplier}-${fileProduct}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Send email with PDF attachment
  const sendEstimateEmail = async () => {
    if (!emailTo || !emailEstimate) return;

    setEmailSending(true);
    try {
      const pdfBase64 = generatePDFBase64(emailEstimate);

      const response = await authFetch(getApiUrl(`/api/costing/${emailEstimate.id}/send-email`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toEmail: emailTo,
          pdfBase64: pdfBase64,
        }),
      });

      if (response.ok) {
        alert('Email sent successfully!');
        setShowEmailModal(false);
        setEmailTo('');
        setEmailEstimate(null);
      } else {
        const data = await response.json();
        alert(`Failed to send email: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error sending email:', err);
      alert('Failed to send email. Please try again.');
    } finally {
      setEmailSending(false);
    }
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM_STATE);
    setEditingId(null);
    if (exchangeRate?.rate) {
      setFormData(prev => ({ ...prev, roe_origin: exchangeRate.rate }));
    }
  };

  // Render input field helper
  const renderInput = (label, field, type = 'text', options = {}) => (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
        {label}
      </label>
      <input
        type={type}
        value={formData[field] || ''}
        onChange={(e) => handleInputChange(field, type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)}
        className="input"
        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd' }}
        {...options}
      />
    </div>
  );

  // Render select field helper
  const renderSelect = (label, field, options) => (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
        {label}
      </label>
      <select
        value={formData[field] || ''}
        onChange={(e) => handleInputChange(field, e.target.value)}
        className="select"
        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd' }}
      >
        <option value="">Select...</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  // Render currency input
  const renderCurrencyInput = (label, field, currency = 'ZAR') => (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
        {label} ({currency})
      </label>
      <input
        type="number"
        value={formData[field] || ''}
        onChange={(e) => handleInputChange(field, parseFloat(e.target.value) || 0)}
        className="input"
        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd' }}
        min="0"
        step="0.01"
      />
    </div>
  );

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading cost estimates...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0b1f3a' }}>Import Costing</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>
            FCL Import Cost Comparison
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {exchangeRate && (
            <div style={{ padding: '8px 12px', backgroundColor: '#f0f9ff', borderRadius: '6px', fontSize: '0.85rem' }}>
              <span style={{ color: '#666' }}>Market Rate: </span>
              <strong>{formatNumber(exchangeRate.rate, 4)}</strong>
              <span style={{ color: '#888', marginLeft: '4px', fontSize: '0.75rem' }}>(ref only - use Finex SA)</span>
            </div>
          )}
          <button
            onClick={() => setShowReports(!showReports)}
            style={{
              padding: '10px 20px', backgroundColor: showReports ? '#7c3aed' : '#8b5cf6', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
            }}
          >
            {showReports ? '✕ Close Reports' : '📊 Reports'}
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            style={{
              padding: '10px 20px', backgroundColor: '#0ea5a8', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
            }}
          >
            + New Estimate
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '1rem' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
        </div>
      )}

      {/* Reports Section */}
      {showReports && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f5f3ff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0, color: '#5b21b6', fontSize: '1.1rem' }}>📊 Cost Analysis by Supplier</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#666' }}>Supplier:</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => {
                      setSelectedSupplier(e.target.value);
                      setSelectedProduct('all'); // Reset product when supplier changes
                    }}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      minWidth: '150px',
                    }}
                  >
                    <option value="all">All Suppliers</option>
                    {allSuppliers.map(supplier => (
                      <option key={supplier} value={supplier}>{supplier}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#666' }}>Product:</label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      minWidth: '150px',
                    }}
                  >
                    <option value="all">All Products</option>
                    {allProducts.map(product => (
                      <option key={product} value={product}>{product}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={generateReportPDF}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  📄 Print PDF
                </button>
              </div>
            </div>
          </div>
          <div style={{ padding: '1.5rem' }}>
            {getSupplierChartData.labels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                No data available for the selected filters.
              </div>
            ) : (
              <>
                <div style={{ height: '350px', marginBottom: '1.5rem' }}>
                  <Bar
                    ref={chartRef}
                    data={{
                      labels: getSupplierChartData.labels,
                      datasets: getSupplierChartData.datasets,
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: {
                        mode: 'index',
                        intersect: false,
                      },
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                        title: {
                          display: true,
                          text: `${selectedSupplier === 'all' ? 'All Suppliers' : selectedSupplier} | ${selectedProduct === 'all' ? 'All Products' : selectedProduct}`,
                          font: { size: 14 }
                        },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const value = context.raw;
                              return `${context.dataset.label}: R ${formatNumber(value, 2)}`;
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          type: 'linear',
                          display: true,
                          position: 'left',
                          title: {
                            display: true,
                            text: 'Total Cost (ZAR)'
                          },
                          ticks: {
                            callback: function(value) {
                              return 'R ' + formatNumber(value, 0);
                            }
                          }
                        },
                        y1: {
                          type: 'linear',
                          display: true,
                          position: 'right',
                          title: {
                            display: true,
                            text: 'Cost per KG (ZAR)'
                          },
                          grid: {
                            drawOnChartArea: false,
                          },
                          ticks: {
                            callback: function(value) {
                              return 'R ' + formatNumber(value, 2);
                            }
                          }
                        },
                      },
                    }}
                  />
                </div>

                {/* Summary Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Supplier</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Estimates</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Total Weight</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Total Cost</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Cost/KG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSupplierChartData.supplierDetails.map((supplier, idx) => (
                        <tr key={supplier.name} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '500' }}>{supplier.name}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>{supplier.estimateCount}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNumber(supplier.totalWeight)} kg</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#059669' }}>{formatCurrency(supplier.totalCost)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#d97706' }}>{formatCurrency(supplier.costPerKg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
          alignItems: 'flex-start', padding: '1rem', zIndex: 1000, overflowY: 'auto'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px',
            width: '95%', maxWidth: '1400px', minWidth: '600px',
            height: '90vh', minHeight: '400px',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            resize: 'both',
          }}>
            {/* Form Header */}
            <div style={{
              padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10
            }}>
              <h3 style={{ margin: 0, color: '#0b1f3a' }}>
                {editingId ? 'Edit Cost Estimate' : 'New Cost Estimate'}
              </h3>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}
              >
                x
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              {/* Section: Header Details */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#0b1f3a', fontSize: '1rem' }}>Shipment Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {renderInput('Reference Number', 'reference_number')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      Supplier
                    </label>
                    {showAddSupplier ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={newSupplierName}
                          onChange={(e) => setNewSupplierName(e.target.value)}
                          placeholder="Enter supplier name..."
                          className="input"
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #0ea5a8' }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); createSupplier(); }
                            if (e.key === 'Escape') { setShowAddSupplier(false); setNewSupplierName(''); }
                          }}
                        />
                        <button
                          type="button"
                          onClick={createSupplier}
                          style={{ padding: '8px 12px', backgroundColor: '#0ea5a8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowAddSupplier(false); setNewSupplierName(''); }}
                          style={{ padding: '8px 12px', backgroundColor: '#f3f4f6', color: '#666', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                          value={formData.supplier_name || ''}
                          onChange={(e) => handleInputChange('supplier_name', e.target.value)}
                          className="select"
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd' }}
                        >
                          <option value="">Select Supplier...</option>
                          {suppliers.map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowAddSupplier(true)}
                          style={{ padding: '8px 12px', backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                        >
                          + New
                        </button>
                      </div>
                    )}
                  </div>
                  {renderInput('Country of Origin', 'country_of_origin')}
                  {renderInput('Port of Loading', 'port_of_loading')}
                  {renderSelect('Port of Discharge', 'port_of_discharge', SA_PORTS)}
                  {renderSelect('Container Type', 'container_type', CONTAINER_TYPES)}
                  {renderSelect('INCO Terms', 'inco_terms', INCO_TERMS)}
                  {renderInput('INCO Term Place', 'inco_term_place')}
                  {renderInput('Transit Time (days)', 'transit_time_days', 'number')}
                  {renderInput('Shipping Line', 'shipping_line')}
                  {renderInput('No. of Containers', 'quantity', 'number')}
                  {renderInput('Costing Date', 'costing_date', 'date')}
                  {renderInput('Validity Date', 'validity_date', 'date')}
                  {renderSelect('Payment Terms', 'payment_terms', PAYMENT_TERMS)}
                </div>
              </div>

              {/* Section: Products in Container */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px', border: '2px solid #f59e0b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, color: '#92400e', fontSize: '1rem' }}>Products in Container</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#b45309' }}>
                      Enter weight and rate/kg to auto-calculate invoice value. Totals populate Origin Charges.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Total Weight</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#78350f' }}>{formatNumber(getTotalWeight())} kg</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Total USD</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#78350f' }}>{formatCurrency(formData.origin_charge_usd || 0, 'USD')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Total EUR</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#78350f' }}>{formatCurrency(formData.origin_charge_eur || 0, 'EUR')}</div>
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fbbf24', color: '#78350f' }}>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Product Name</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>HS Code</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Pack Size</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Pack Type</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Weight (kg)</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Rate/kg</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Currency</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #f59e0b', backgroundColor: '#f59e0b', color: 'white' }}>Invoice Value</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Weight %</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Duty %</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Sch 1 %</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(formData.products || []).map((product, index) => {
                        const totalWeight = getTotalWeight();
                        const productWeight = parseFloat(product.weight_kg) || 0;
                        const weightPercent = totalWeight > 0 ? (productWeight / totalWeight * 100) : 0;
                        return (
                          <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fffbeb' : '#fef3c7' }}>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="text"
                                value={product.name || ''}
                                onChange={(e) => updateProduct(index, 'name', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem' }}
                                placeholder="e.g. SHMP 26/30"
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="text"
                                value={product.hs_code || ''}
                                onChange={(e) => updateProduct(index, 'hs_code', e.target.value)}
                                style={{ width: '100px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem' }}
                                placeholder="0306.17"
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="text"
                                value={product.pack_size || ''}
                                onChange={(e) => updateProduct(index, 'pack_size', e.target.value)}
                                style={{ width: '70px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'center' }}
                                placeholder="10x1kg"
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="text"
                                value={product.pack_type || ''}
                                onChange={(e) => updateProduct(index, 'pack_type', e.target.value)}
                                style={{ width: '80px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'center' }}
                                placeholder="Carton"
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                value={product.weight_kg || ''}
                                onChange={(e) => updateProduct(index, 'weight_kg', parseFloat(e.target.value) || 0)}
                                style={{ width: '90px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'right' }}
                                step="0.01"
                                placeholder="0.00"
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                value={product.rate_per_kg || ''}
                                onChange={(e) => updateProduct(index, 'rate_per_kg', parseFloat(e.target.value) || 0)}
                                style={{ width: '80px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'right' }}
                                step="0.01"
                                placeholder="0.00"
                              />
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <select
                                value={product.currency || 'USD'}
                                onChange={(e) => updateProduct(index, 'currency', e.target.value)}
                                style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem' }}
                              >
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="ZAR">ZAR</option>
                              </select>
                            </td>
                            <td style={{ padding: '6px 8px', backgroundColor: '#fde68a' }}>
                              <div style={{ padding: '6px 8px', fontWeight: '600', color: '#92400e', textAlign: 'right' }}>
                                {formatNumber(product.invoice_value || 0, 2)}
                              </div>
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '600', color: '#92400e' }}>
                              {formatNumber(weightPercent, 1)}%
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                value={product.duty_percent || ''}
                                onChange={(e) => updateProduct(index, 'duty_percent', parseFloat(e.target.value) || 0)}
                                style={{ width: '60px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'center' }}
                                step="0.1"
                                placeholder="0"
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                value={product.duty_schedule1_percent || ''}
                                onChange={(e) => updateProduct(index, 'duty_schedule1_percent', parseFloat(e.target.value) || 0)}
                                style={{ width: '60px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'center' }}
                                step="0.1"
                                placeholder="0"
                              />
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              {formData.products.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeProduct(index)}
                                  style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={addProduct}
                    style={{ padding: '8px 16px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
                  >
                    + Add Product
                  </button>
                </div>
              </div>

              {/* Section: Exchange Rate & Customs Value */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#065f46', fontSize: '1rem' }}>Finex SA Exchange Rates</h4>
                <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#666' }}>Enter the Finex SA rates from your daily email</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#166534' }}>
                      USD/ZAR Rate
                    </label>
                    <input
                      type="number"
                      value={formData.roe_origin || ''}
                      onChange={(e) => handleInputChange('roe_origin', parseFloat(e.target.value) || '')}
                      className="input"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '2px solid #10b981', backgroundColor: '#f0fdf4' }}
                      step="0.0001"
                      placeholder="e.g. 18.50"
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#1d4ed8' }}>
                      EUR/ZAR Rate
                    </label>
                    <input
                      type="number"
                      value={formData.roe_eur || ''}
                      onChange={(e) => handleInputChange('roe_eur', parseFloat(e.target.value) || '')}
                      className="input"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '2px solid #3b82f6', backgroundColor: '#eff6ff' }}
                      step="0.0001"
                      placeholder="e.g. 20.50"
                    />
                  </div>
                </div>
              </div>

              {/* Section: Ocean Freight */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '8px', border: '2px solid #3b82f6' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#1d4ed8', fontSize: '1rem' }}>Ocean Freight</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('Ocean Freight', 'ocean_freight_usd', 'USD')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#166534' }}>
                      USD to ZAR - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '6px', fontWeight: '600', color: '#166534' }}>
                      {formatCurrency((parseFloat(formData.ocean_freight_usd) || 0) * (parseFloat(formData.roe_origin) || 0))}
                    </div>
                  </div>
                  {renderCurrencyInput('Ocean Freight', 'ocean_freight_eur', 'EUR')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#1d4ed8' }}>
                      EUR to ZAR - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '6px', fontWeight: '600', color: '#1d4ed8' }}>
                      {formatCurrency((parseFloat(formData.ocean_freight_eur) || 0) * (parseFloat(formData.roe_eur) || 0))}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem', padding: '12px', backgroundColor: '#dbeafe', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '500', color: '#1d4ed8' }}>Total Ocean Freight (ZAR)</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1d4ed8' }}>
                      {formatCurrency(
                        ((parseFloat(formData.ocean_freight_usd) || 0) * (parseFloat(formData.roe_origin) || 0)) +
                        ((parseFloat(formData.ocean_freight_eur) || 0) * (parseFloat(formData.roe_eur) || 0))
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section: Origin Charges */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#166534', fontSize: '1rem' }}>Origin Charges</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('Origin Charge', 'origin_charge_usd', 'USD')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#166534' }}>
                      USD to ZAR - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '6px', fontWeight: '600', color: '#166534' }}>
                      {formatCurrency((parseFloat(formData.origin_charge_usd) || 0) * (parseFloat(formData.roe_origin) || 0))}
                    </div>
                  </div>
                  {renderCurrencyInput('Origin Charge', 'origin_charge_eur', 'EUR')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#1d4ed8' }}>
                      EUR to ZAR - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '6px', fontWeight: '600', color: '#1d4ed8' }}>
                      {formatCurrency((parseFloat(formData.origin_charge_eur) || 0) * (parseFloat(formData.roe_eur) || 0))}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem', padding: '12px', backgroundColor: '#dcfce7', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '500', color: '#166534' }}>Total Origin Charges (ZAR)</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#166534' }}>
                      {formatCurrency(calculatedTotals.total_origin_charges_zar)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section: Local Charges (Transport/Cartage) */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#166534', fontSize: '1rem' }}>Local Charges (Transport/Cartage) - ZAR</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('Local Cartage: CPT to Klapmuts (<20 Ton)', 'local_cartage_cpt_klapmuts_20ton_zar')}
                  {renderCurrencyInput('Local Cartage: CPT to Klapmuts (21-28 Ton)', 'local_cartage_cpt_klapmuts_28ton_zar')}
                  {renderCurrencyInput('Transport: DBN Port to Pretoria (20FT)', 'transport_dbn_to_pretoria_20ft_zar')}
                  {renderCurrencyInput('Transport: DBN Port to Pretoria (40FT)', 'transport_dbn_to_pretoria_40ft_zar')}
                  {renderCurrencyInput('Transport: DBN Port to WHS', 'transport_dbn_to_whs_zar')}
                  {renderCurrencyInput('Unpack / Reload', 'unpack_reload_zar')}
                  {renderCurrencyInput('Storage (Per Pallet Per Day)', 'storage_zar')}
                  {renderInput('Storage Days (3 Days Free)', 'storage_days', 'number')}
                  {renderCurrencyInput('Outlying Container Depot Surcharge', 'outlying_depot_surcharge_zar')}
                  {renderCurrencyInput('Local Cartage: DBN WHS to PTA (Tautliner A)', 'local_cartage_dbn_whs_pretoria_opt_a_zar')}
                  {renderCurrencyInput('Local Cartage: DBN WHS to PTA (Tautliner B)', 'local_cartage_dbn_whs_pretoria_opt_b_zar')}
                  {renderCurrencyInput('Local Cartage: DBN WHS to PTA (6M Deck)', 'local_cartage_dbn_whs_pretoria_6m_zar')}
                  {renderCurrencyInput('Local Cartage: DBN WHS to PTA (12M Deck)', 'local_cartage_dbn_whs_pretoria_12m_zar')}
                  {renderCurrencyInput('Transport: PE/Coega Port to Pretoria', 'transport_pe_coega_to_pretoria_zar')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      Local Charges Sub-Total - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '6px', fontWeight: '600', color: '#166534' }}>
                      {formatCurrency(calculatedTotals.local_charges_subtotal_zar)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Destination Charges (Port/Shipping) */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#1e40af', fontSize: '1rem' }}>Destination Charges - ZAR</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('Shipping Line Charges (At Cost)', 'shipping_line_charges_zar')}
                  {renderCurrencyInput('Cargo Dues (20FT)', 'cargo_dues_20ft_zar')}
                  {renderCurrencyInput('Cargo Dues (40FT)', 'cargo_dues_40ft_zar')}
                  {renderCurrencyInput('CTO Fee', 'cto_fee_zar')}
                  {renderCurrencyInput('Port Health Inspection', 'port_health_inspection_zar')}
                  {renderCurrencyInput('DAFF Inspection', 'daff_inspection_zar')}
                  {renderCurrencyInput('State Vet Cancellation Fee', 'state_vet_cancellation_fee_zar')}
                  {renderCurrencyInput('JNB Turn In (At Cost)', 'jnb_turn_in_zar')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      Destination Sub-Total - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '6px', fontWeight: '600', color: '#1e40af' }}>
                      {formatCurrency(calculatedTotals.destination_charges_subtotal_zar)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Customs VAT & Duty Summary */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#92400e', fontSize: '1rem' }}>Customs & Duties Summary</h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#92400e' }}>
                      ROE for Customs
                    </label>
                    <input
                      type="number"
                      value={formData.roe_customs || ''}
                      onChange={(e) => handleInputChange('roe_customs', parseFloat(e.target.value) || '')}
                      placeholder={formData.roe_origin || 'Uses USD rate'}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '2px solid #f59e0b', fontSize: '0.9rem', fontWeight: '600' }}
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#92400e' }}>
                      Total Customs Value
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#fde68a', borderRadius: '6px', fontWeight: '600', color: '#78350f' }}>
                      {formatCurrency(getCustomsTotals().totalCustomsValue)}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#92400e' }}>
                      Total Duties
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#fde68a', borderRadius: '6px', fontWeight: '600', color: '#78350f' }}>
                      {formatCurrency(getCustomsTotals().totalDuties + getCustomsTotals().totalSchedule1Duty)}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#92400e' }}>
                      IMPORT VAT (15%)
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#fde68a', borderRadius: '6px', fontWeight: '600', color: '#78350f' }}>
                      {formatCurrency(getCustomsTotals().totalVat)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('Customs Declaration', 'customs_declaration_zar')}
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#92400e' }}>
                      Agency Fee ({formData.agency_fee_percentage}% min R{formData.agency_fee_min})
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#fde68a', borderRadius: '6px', fontWeight: '600', color: '#92400e' }}>
                      {formatCurrency(calculatedTotals.agency_fee_zar)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#78350f', marginTop: '2px' }}>
                      Based on Duties + Import VAT
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#92400e' }}>
                      Customs Sub-Total (excl. Import VAT)
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#b45309', borderRadius: '6px', fontWeight: '700', color: 'white', fontSize: '1.1rem' }}>
                      {formatCurrency(getCustomsTotals().totalDuties + getCustomsTotals().totalSchedule1Duty + (parseFloat(formData.customs_declaration_zar) || 0) + (calculatedTotals.agency_fee_zar || 0))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Product Cost Allocation */}
              {formData.products && formData.products.length > 0 && getTotalWeight() > 0 && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '2px solid #10b981' }}>
                  <h4 style={{ margin: '0 0 1rem', color: '#065f46', fontSize: '1rem' }}>Product Cost Allocation</h4>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#047857' }}>
                    Shipping costs allocated by weight. Each product shows its share of total costs.
                  </p>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#10b981', color: 'white' }}>
                          <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Product</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600' }}>Weight</th>
                          <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600' }}>Share %</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600' }}>Customs Value</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600' }}>Duties</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600' }}>Shipping Alloc.</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', backgroundColor: '#059669' }}>Total Landed</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', backgroundColor: '#059669' }}>Cost/kg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(formData.products || []).map((product, index) => {
                          const allocation = calculateProductAllocation(product);
                          const customs = calculateProductCustomsValues(product);
                          const productWeight = parseFloat(product.weight_kg) || 0;
                          return (
                            <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ecfdf5' : '#d1fae5' }}>
                              <td style={{ padding: '8px', fontWeight: '500', color: '#065f46' }}>
                                {product.name || `Product ${index + 1}`}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                {formatNumber(productWeight)} kg
                              </td>
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: '600', color: '#047857' }}>
                                {formatNumber(allocation.weightRatio * 100, 1)}%
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                {formatCurrency(customs.customsValue)}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                {formatCurrency(customs.totalDuties + customs.schedule1Duty)}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                {formatCurrency(allocation.allocatedShippingCost)}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#065f46', backgroundColor: '#a7f3d0' }}>
                                {formatCurrency(allocation.totalProductCost)}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#065f46', backgroundColor: '#a7f3d0' }}>
                                {formatCurrency(allocation.costPerKg)}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Totals Row */}
                        <tr style={{ backgroundColor: '#059669', color: 'white', fontWeight: '700' }}>
                          <td style={{ padding: '10px 8px' }}>TOTALS</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatNumber(getTotalWeight())} kg</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>100%</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(getCustomsTotals().totalCustomsValue)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(getCustomsTotals().totalDuties + getCustomsTotals().totalSchedule1Duty)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(calculatedTotals.total_shipping_cost_zar)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(calculatedTotals.total_in_warehouse_cost_zar)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(calculatedTotals.all_in_warehouse_cost_per_kg_zar)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section: Totals Summary */}
              <div style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: '#0b1f3a', borderRadius: '8px', color: 'white' }}>
                <h4 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Summary Totals</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Total Shipping Cost</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>{formatCurrency(calculatedTotals.total_shipping_cost_zar)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Total in Warehouse Cost</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>{formatCurrency(calculatedTotals.total_in_warehouse_cost_zar)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Cost per KG</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f59e0b' }}>{formatCurrency(calculatedTotals.all_in_warehouse_cost_per_kg_zar)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Status</div>
                    <select
                      value={formData.status}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', width: '100%' }}
                    >
                      <option value="draft">Draft</option>
                      <option value="final">Final</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                  Notes
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="input"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', minHeight: '80px' }}
                  placeholder="Additional notes..."
                />
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  style={{
                    padding: '10px 20px', backgroundColor: '#f3f4f6', color: '#374151',
                    border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 24px', backgroundColor: '#0ea5a8', color: 'white',
                    border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
                  }}
                >
                  {editingId ? 'Update Estimate' : 'Create Estimate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Estimates Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {/* Search and Sort Controls */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '200px', maxWidth: '300px' }}>
            <input
              type="text"
              placeholder="Search by reference or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.9rem',
              }}
            />
          </div>
          <button
            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
            style={{
              padding: '8px 12px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Reference {sortDirection === 'asc' ? '↑ A-Z' : '↓ Z-A'}
          </button>
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            {filteredEstimates.length} of {estimates.length} estimates
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Reference</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Supplier</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Port</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Container</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb', minWidth: '280px' }}>Products</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Total Cost</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Cost/KG</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEstimates.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
                    {searchTerm ? 'No estimates match your search.' : 'No cost estimates yet. Create your first estimate to get started.'}
                  </td>
                </tr>
              ) : (
                filteredEstimates.map((est) => {
                  const totals = calculateAllTotals(est);
                  const products = est.products || [];
                  return (
                    <tr key={est.id} style={{ borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }}>
                      <td style={{ padding: '12px 16px', color: '#111827' }}>{est.reference_number || est.id.slice(0, 8)}</td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{est.supplier_name || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{est.port_of_discharge || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{est.container_type || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>
                        {products.length === 0 ? (
                          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No products</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {products.map((p, idx) => (
                              <div key={idx} style={{
                                padding: '6px 8px',
                                backgroundColor: '#fef3c7',
                                borderRadius: '4px',
                                borderLeft: '3px solid #f59e0b',
                                fontSize: '0.8rem'
                              }}>
                                <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '2px' }}>
                                  {p.name || `Product ${idx + 1}`}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', color: '#78350f', fontSize: '0.75rem' }}>
                                  {p.hs_code && <span>HS: {p.hs_code}</span>}
                                  {p.pack_size && <span>Size: {p.pack_size}</span>}
                                  {p.pack_type && <span>Type: {p.pack_type}</span>}
                                  {p.weight_kg > 0 && <span>Wt: {formatNumber(p.weight_kg)}kg</span>}
                                  {p.rate_per_kg > 0 && <span>Rate: {formatNumber(p.rate_per_kg)}/{p.currency || 'USD'}</span>}
                                  {p.invoice_value > 0 && <span style={{ fontWeight: '600' }}>Val: {formatNumber(p.invoice_value)} {p.currency || 'USD'}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#059669' }}>
                        {formatCurrency(totals.total_in_warehouse_cost_zar)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500', color: '#d97706' }}>
                        {formatCurrency(totals.all_in_warehouse_cost_per_kg_zar)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500',
                          backgroundColor: est.status === 'final' ? '#dcfce7' : est.status === 'archived' ? '#f3f4f6' : '#fef3c7',
                          color: est.status === 'final' ? '#166534' : est.status === 'archived' ? '#6b7280' : '#92400e'
                        }}>
                          {est.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleEdit(est)}
                            style={{ padding: '6px 10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => generatePDF(est)}
                            style={{ padding: '6px 10px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => { setEmailEstimate(est); setShowEmailModal(true); }}
                            style={{ padding: '6px 10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Email
                          </button>
                          <button
                            onClick={() => handleDuplicate(est.id)}
                            style={{ padding: '6px 10px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => handleDelete(est.id)}
                            style={{ padding: '6px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && emailEstimate && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem',
            width: '100%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <h3 style={{ margin: '0 0 1rem', color: '#0b1f3a' }}>Send Cost Estimate via Email</h3>

            <div style={{ marginBottom: '1rem', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Reference</div>
              <div style={{ fontWeight: '600' }}>{emailEstimate.reference_number || emailEstimate.id}</div>
              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '8px' }}>Supplier</div>
              <div style={{ fontWeight: '600' }}>{emailEstimate.supplier_name || 'N/A'}</div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                Send to Email Address
              </label>
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="colleague@company.com"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.95rem' }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowEmailModal(false); setEmailTo(''); setEmailEstimate(null); }}
                style={{ padding: '10px 20px', backgroundColor: '#f3f4f6', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Cancel
              </button>
              <button
                onClick={sendEstimateEmail}
                disabled={!emailTo || emailSending}
                style={{
                  padding: '10px 20px',
                  backgroundColor: emailSending ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: emailSending ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}
              >
                {emailSending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportCosting;
