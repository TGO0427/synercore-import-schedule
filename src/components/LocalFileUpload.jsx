import React, { useState, useRef } from 'react';
import { ExcelProcessor } from '../utils/excelProcessor';
import ImportValidationPreview from './ImportValidationPreview';
import { useNotification } from '../contexts/NotificationContext';
import XLSX from 'xlsx';
import './FileUpload.css';

// International suppliers to exclude from local receiving imports
const EXCLUDED_SUPPLIERS = [
  'SACCO S.R.L',
  'QIDA CHEMICAL CO. LTD',
  'SHAKTI CHEMICALS',
  'AROMSA BESIN AROMA VE KATKI MADDELERI SAN. VE TIC. A.S.',
  'AROMSA BESIN AROMA VE KATKI MADDELERI SAN. VE TIC. A.Ş.',
  'AB MAURI',
  'ECOLEX SDN. BHD',
  'MARCEL CARRAGEENAN',
  'TRISTAR GLOBAL SDN. BHD',
];

function isExcludedSupplier(supplier) {
  if (!supplier) return false;
  const normalized = supplier.trim().toUpperCase();
  return EXCLUDED_SUPPLIERS.some(exc => normalized.includes(exc) || exc.includes(normalized));
}

function LocalFileUpload({ onFileUpload, loading }) {
  const { showError, showWarning, showSuccess } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationData, setValidationData] = useState(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const fileInputRef = useRef(null);
  const currentFileRef = useRef(null);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileSelection(files[0]);
  };
  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) handleFileSelection(files[0]);
  };

  const [excludedCount, setExcludedCount] = useState(0);

  const handleValidateFile = async (file) => {
    try {
      setValidationLoading(true);
      const result = await ExcelProcessor.parseExcelFileWithValidation(file);

      // Filter out international suppliers
      if (result.validRows && result.validRows.length > 0) {
        const before = result.validRows.length;
        result.validRows = result.validRows.filter(row => {
          const supplier = row.supplier || row.SUPPLIER || row.Supplier || '';
          return !isExcludedSupplier(supplier);
        });
        const removed = before - result.validRows.length;
        setExcludedCount(removed);
        if (removed > 0) {
          // Also filter preview
          result.preview = result.validRows.slice(0, 5);
        }
      }

      setValidationData(result);
      currentFileRef.current = file;
    } catch (error) {
      showError(`Error reading file: ${error.message}`);
    } finally {
      setValidationLoading(false);
    }
  };

  const handleFileSelection = (file) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel', '.xlsx', '.xls',
    ];
    const isValidType = validTypes.some(t => file.type === t || file.name.toLowerCase().endsWith(t));
    if (!isValidType) { showWarning('Please select a valid Excel file (.xlsx or .xls)'); return; }
    if (file.size > 10 * 1024 * 1024) { showWarning('File size must be less than 10MB'); return; }
    handleValidateFile(file);
  };

  const handleProceedWithImport = () => {
    if (validationData?.validRows && validationData.validRows.length > 0) {
      if (excludedCount > 0) {
        showSuccess(`${excludedCount} international supplier row(s) excluded`);
      }
      // Pass shipmentType='local' as third argument
      onFileUpload(currentFileRef.current, undefined, 'local');
      setValidationData(null);
      setExcludedCount(0);
    }
  };

  const handleCancelValidation = () => {
    setValidationData(null);
    currentFileRef.current = null;
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      'SUPPLIER': 'Local Supplier Ltd',
      'ORDER/REF': 'APO0017500',
      'PRODUCT NAME': 'Sodium Chloride',
      'QUANTITY': 500,
      'PALLET QTY': 2,
      'RECEIVING WAREHOUSE': 'PRETORIA',
      'FORWARDING AGENT': 'DSV',
      'LATEST STATUS': 'in_transit_roadway',
      'NOTES': 'Expected delivery 28 Mar',
    }]);
    ws['!cols'] = [
      { wch: 22 }, { wch: 15 }, { wch: 30 }, { wch: 10 },
      { wch: 10 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 25 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Local Receiving Template');
    XLSX.writeFile(wb, 'local_receiving_template.xlsx');
  };

  return (
    <>
      <div className="fu-section" style={{ padding: isOpen ? undefined : 0 }}>
        <button
          id="local-import-toggle"
          onClick={() => setIsOpen(prev => !prev)}
          type="button"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '8px 14px', background: isOpen ? 'var(--surface-2)' : 'transparent', border: 'none',
            borderBottom: isOpen ? '1px solid var(--border)' : 'none',
            borderRadius: isOpen ? '8px 8px 0 0' : 6,
            cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-600)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
          onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: 10 }}>▶</span>
          Import Excel File
          <span style={{ fontWeight: 400, color: 'var(--text-400)', fontSize: 11 }}>Upload a local receiving schedule spreadsheet</span>
        </button>

        {isOpen && (
          <div style={{ padding: '1rem 1.25rem' }}>
            <div className="fu-actions">
              <button className="btn btn-secondary" onClick={handleDownloadTemplate} type="button">
                Download Template
              </button>
              <span className="fu-actions-hint">Download a local receiving Excel template</span>
            </div>

            <div
              className={`fu-dropzone ${isDragOver ? 'is-dragover' : ''} ${validationLoading || loading ? 'is-loading' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleUploadClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleUploadClick()}
              aria-busy={validationLoading || loading ? 'true' : 'false'}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInputChange}
                className="fu-input"
                disabled={validationLoading || loading}
              />

              {validationLoading || loading ? (
                <div className="fu-state fu-state--loading">
                  <div className="fu-emoji" aria-hidden>⏳</div>
                  <p>{validationLoading ? 'Validating file...' : 'Processing file...'}</p>
                </div>
              ) : (
                <div className="fu-state">
                  <div className="fu-emoji fu-emoji--accent" aria-hidden>📊</div>
                  <h4 className="fu-headline">Drag and drop your Excel file here</h4>
                  <p className="fu-hint">or click to browse</p>
                  <button className="btn" type="button">Choose File</button>
                </div>
              )}
            </div>

            <div className="fu-help">
              <p><strong>Supported formats:</strong> .xlsx, .xls</p>
              <p><strong>Maximum file size:</strong> 10MB</p>
              <p>
                <strong>Expected columns:</strong> SUPPLIER, ORDER/REF, PRODUCT NAME,
                QUANTITY, PALLET QTY, RECEIVING WAREHOUSE, FORWARDING AGENT (carrier), LATEST STATUS, NOTES
              </p>
              <p style={{ color: 'var(--text-500)', fontSize: '0.8rem' }}>
                <strong>Note:</strong> International suppliers (Sacco, Qida, Shakti, Aromsa, AB Mauri, Ecolex, Marcel Carrageenan, Tristar) are automatically excluded.
              </p>
            </div>
          </div>
        )}
      </div>

      {validationData && (
        <ImportValidationPreview
          errors={validationData.errors}
          preview={validationData.preview}
          validCount={validationData.validRows?.length || 0}
          onProceed={handleProceedWithImport}
          onCancel={handleCancelValidation}
          loading={loading}
        />
      )}
    </>
  );
}

export default LocalFileUpload;
