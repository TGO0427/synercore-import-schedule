// src/components/FileUpload.jsx
import React, { useState, useRef } from 'react';
import { ExcelProcessor } from '../utils/excelProcessor';
import ImportValidationPreview from './ImportValidationPreview';
import './FileUpload.css'; // ← add this

function FileUpload({ onFileUpload, loading }) {
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

  const handleValidateFile = async (file) => {
    try {
      setValidationLoading(true);
      const result = await ExcelProcessor.parseExcelFileWithValidation(file);
      setValidationData(result);
      currentFileRef.current = file;
    } catch (error) {
      alert(`Error reading file: ${error.message}`);
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
    if (!isValidType) return alert('Please select a valid Excel file (.xlsx or .xls)');
    if (file.size > 10 * 1024 * 1024) return alert('File size must be less than 10MB');

    // Validate file before showing preview
    handleValidateFile(file);
  };

  const handleProceedWithImport = () => {
    if (validationData?.validRows && validationData.validRows.length > 0) {
      onFileUpload(currentFileRef.current);
      setValidationData(null);
    }
  };

  const handleCancelValidation = () => {
    setValidationData(null);
    currentFileRef.current = null;
  };

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleDownloadTemplate = () => ExcelProcessor.downloadTemplate();

  return (
    <>
      <div className="fu-section">
        <h3 className="fu-title">Import Excel File</h3>
        <p className="fu-subtitle">Upload your existing shipment schedule Excel file to import all shipments at once.</p>

        <div className="fu-actions">
          <button className="btn btn-secondary" onClick={handleDownloadTemplate} type="button">
            📥 Download Template
          </button>
          <span className="fu-actions-hint">Download a properly formatted Excel template</span>
        </div>

        <div
          className={`fu-dropzone ${isDragOver ? 'is-dragover' : ''} ${validationLoading || loading ? 'is-loading' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleUploadClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e)=> (e.key === 'Enter' || e.key === ' ') && handleUploadClick()}
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
            <strong>Expected columns:</strong> SUPPLIER, ORDER/REF, FINAL POD, LATEST STATUS, WEEK NUMBER, PRODUCT NAME,
            QUANTITY, PALLET QTY, RECEIVING WAREHOUSE, FORWARDING AGENT
          </p>
        </div>
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

export default FileUpload;
