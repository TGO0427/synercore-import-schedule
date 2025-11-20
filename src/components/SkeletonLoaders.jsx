import React from 'react';
import './SkeletonLoaders.css';

/**
 * Generic Skeleton Component
 * Used as building block for other skeleton loaders
 */
export function SkeletonPulse({ width = '100%', height = '20px', borderRadius = '4px', className = '' }) {
  return (
    <div
      className={`skeleton-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius
      }}
    />
  );
}

/**
 * Table Row Skeleton
 * Simulates a table row with multiple columns
 */
export function SkeletonTableRow({ columns = 5, height = '50px' }) {
  return (
    <div className="skeleton-table-row" style={{ height }}>
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="skeleton-table-cell">
          <SkeletonPulse height="20px" width="80%" />
        </div>
      ))}
    </div>
  );
}

/**
 * Table Skeleton
 * Simulates a full table with header and rows
 */
export function SkeletonTable({ rows = 5, columns = 5 }) {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-header">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="skeleton-table-header-cell">
            <SkeletonPulse height="24px" width="90%" />
          </div>
        ))}
      </div>
      <div className="skeleton-table-body">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} columns={columns} />
        ))}
      </div>
    </div>
  );
}

/**
 * Form Input Skeleton
 * Simulates a form field with label
 */
export function SkeletonFormField() {
  return (
    <div className="skeleton-form-field">
      <SkeletonPulse height="16px" width="120px" className="skeleton-label" />
      <SkeletonPulse height="40px" width="100%" borderRadius="6px" />
    </div>
  );
}

/**
 * Form Skeleton
 * Simulates a form with multiple fields
 */
export function SkeletonForm({ fields = 4 }) {
  return (
    <div className="skeleton-form">
      {Array.from({ length: fields }).map((_, i) => (
        <SkeletonFormField key={i} />
      ))}
      <div className="skeleton-form-actions">
        <SkeletonPulse height="40px" width="120px" borderRadius="6px" />
        <SkeletonPulse height="40px" width="100px" borderRadius="6px" />
      </div>
    </div>
  );
}

/**
 * Card Skeleton
 * Simulates a card with image, title, and content
 */
export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <SkeletonPulse height="200px" width="100%" borderRadius="8px 8px 0 0" />
      <div className="skeleton-card-content">
        <SkeletonPulse height="24px" width="70%" className="skeleton-title" />
        <SkeletonPulse height="16px" width="100%" className="skeleton-text" />
        <SkeletonPulse height="16px" width="95%" className="skeleton-text" />
        <SkeletonPulse height="16px" width="80%" className="skeleton-text" />
      </div>
    </div>
  );
}

/**
 * Grid of Skeleton Cards
 * Simulates multiple cards in a grid layout
 */
export function SkeletonCardGrid({ count = 4, columns = 4 }) {
  return (
    <div className="skeleton-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * List Item Skeleton
 * Simulates a single list item with avatar and text
 */
export function SkeletonListItem() {
  return (
    <div className="skeleton-list-item">
      <SkeletonPulse height="40px" width="40px" borderRadius="50%" className="skeleton-avatar" />
      <div className="skeleton-list-content">
        <SkeletonPulse height="18px" width="40%" className="skeleton-title" />
        <SkeletonPulse height="14px" width="60%" className="skeleton-text" />
      </div>
    </div>
  );
}

/**
 * List Skeleton
 * Simulates a list with multiple items
 */
export function SkeletonList({ items = 5 }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

/**
 * Header/Navigation Skeleton
 * Simulates a page header with navigation
 */
export function SkeletonHeader() {
  return (
    <div className="skeleton-header">
      <SkeletonPulse height="40px" width="150px" borderRadius="6px" />
      <div className="skeleton-header-nav">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonPulse key={i} height="20px" width="80px" />
        ))}
      </div>
    </div>
  );
}

/**
 * Page Skeleton (Full Page Loader)
 * Simulates entire page with header, sidebar, and content
 */
export function SkeletonPage() {
  return (
    <div className="skeleton-page">
      <div className="skeleton-page-header">
        <SkeletonHeader />
      </div>
      <div className="skeleton-page-content">
        <div className="skeleton-page-sidebar">
          <SkeletonList items={5} />
        </div>
        <div className="skeleton-page-main">
          <SkeletonTable rows={8} columns={5} />
        </div>
      </div>
    </div>
  );
}

/**
 * Conditional Skeleton Wrapper
 * Show skeleton while loading, content when loaded
 */
export function SkeletonWrapper({ isLoading, skeleton: SkeletonComponent, children }) {
  if (isLoading) {
    return <SkeletonComponent />;
  }
  return children;
}

/**
 * Shipment Table Skeleton
 * Specialized skeleton for shipment table view
 */
export function SkeletonShipmentTable({ rows = 10 }) {
  return (
    <div className="skeleton-shipment-table">
      <div className="skeleton-table-header">
        <div className="skeleton-table-header-cell" style={{ flex: '1 1 80px' }}>
          <SkeletonPulse height="20px" width="60%" />
        </div>
        <div className="skeleton-table-header-cell" style={{ flex: '1 1 120px' }}>
          <SkeletonPulse height="20px" width="80%" />
        </div>
        <div className="skeleton-table-header-cell" style={{ flex: '1 1 100px' }}>
          <SkeletonPulse height="20px" width="70%" />
        </div>
        <div className="skeleton-table-header-cell" style={{ flex: '1 1 100px' }}>
          <SkeletonPulse height="20px" width="70%" />
        </div>
        <div className="skeleton-table-header-cell" style={{ flex: '1 1 120px' }}>
          <SkeletonPulse height="20px" width="80%" />
        </div>
        <div className="skeleton-table-header-cell" style={{ flex: '1 1 80px' }}>
          <SkeletonPulse height="20px" width="60%" />
        </div>
      </div>
      <div className="skeleton-table-body">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton-shipment-row">
            <div className="skeleton-table-cell" style={{ flex: '1 1 80px' }}>
              <SkeletonPulse height="18px" width="70%" />
            </div>
            <div className="skeleton-table-cell" style={{ flex: '1 1 120px' }}>
              <SkeletonPulse height="18px" width="90%" />
            </div>
            <div className="skeleton-table-cell" style={{ flex: '1 1 100px' }}>
              <SkeletonPulse height="18px" width="80%" />
            </div>
            <div className="skeleton-table-cell" style={{ flex: '1 1 100px' }}>
              <SkeletonPulse height="18px" width="80%" />
            </div>
            <div className="skeleton-table-cell" style={{ flex: '1 1 120px' }}>
              <SkeletonPulse height="18px" width="90%" />
            </div>
            <div className="skeleton-table-cell" style={{ flex: '1 1 80px' }}>
              <SkeletonPulse height="18px" width="70%" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default {
  SkeletonPulse,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonFormField,
  SkeletonForm,
  SkeletonCard,
  SkeletonCardGrid,
  SkeletonListItem,
  SkeletonList,
  SkeletonHeader,
  SkeletonPage,
  SkeletonWrapper,
  SkeletonShipmentTable
};
