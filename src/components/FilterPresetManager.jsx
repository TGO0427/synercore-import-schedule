import React, { useState } from 'react';
import filterPreferencesManager from '../utils/filterPreferences';

/**
 * FilterPresetManager Component
 * Provides UI for saving, loading, and managing filter presets
 *
 * Props:
 * - viewName: string - Name of the view (e.g., 'shipments')
 * - currentFilters: object - Current filter values
 * - onLoadPreset: function - Callback when preset is loaded
 * - onSavePreset: function - Callback when preset is saved
 */
function FilterPresetManager({ viewName, currentFilters, onLoadPreset, onSavePreset }) {
  const [isOpen, setIsOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showNewPreset, setShowNewPreset] = useState(false);
  const savedPresets = filterPreferencesManager.getPresets(viewName);
  const presetsList = Object.entries(savedPresets).sort(
    ([, a], [, b]) => new Date(b.lastUsed) - new Date(a.lastUsed)
  );

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      alert('Please enter a preset name');
      return;
    }

    const success = filterPreferencesManager.savePreset(
      viewName,
      presetName,
      currentFilters
    );

    if (success) {
      onSavePreset?.(presetName);
      setPresetName('');
      setShowNewPreset(false);
      // Force re-render by triggering a state update
      setIsOpen(!isOpen);
      setTimeout(() => setIsOpen(!isOpen), 0);
    }
  };

  const handleLoadPreset = (name) => {
    const filters = filterPreferencesManager.loadPreset(viewName, name);
    if (filters) {
      onLoadPreset?.(filters);
      setIsOpen(false);
    }
  };

  const handleDeletePreset = (name, e) => {
    e.stopPropagation();
    if (window.confirm(`Delete preset "${name}"?`)) {
      filterPreferencesManager.deletePreset(viewName, name);
      // Force re-render
      setIsOpen(!isOpen);
      setTimeout(() => setIsOpen(!isOpen), 0);
    }
  };

  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Manage filter presets"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: isOpen ? '#667eea' : '#f3f4f6',
          color: isOpen ? 'white' : '#374151',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: '500',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.target.style.backgroundColor = '#e5e7eb';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.target.style.backgroundColor = '#f3f4f6';
          }
        }}
      >
        <span>⭐</span>
        <span>Filter Presets ({presetsList.length})</span>
        <span style={{ fontSize: '0.7rem' }}>▼</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '8px',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '280px',
            maxHeight: '400px',
            overflow: 'auto',
            zIndex: 1000
          }}
        >
          {/* Header */}
          <div style={{
            padding: '12px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            fontWeight: '600',
            color: '#374151',
            fontSize: '0.9rem'
          }}>
            Saved Filter Presets
          </div>

          {/* Presets List */}
          {presetsList.length > 0 ? (
            <div>
              {presetsList.map(([name, data]) => (
                <div
                  key={name}
                  onClick={() => handleLoadPreset(name)}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background-color 0.2s ease',
                    backgroundColor: '#ffffff'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: '500',
                      color: '#1f2937',
                      marginBottom: '2px'
                    }}>
                      {name}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#9ca3af'
                    }}>
                      Last used: {getRelativeTime(data.lastUsed)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeletePreset(name, e)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#fecaca';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#fee2e2';
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '20px 12px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '0.9rem'
            }}>
              No saved presets yet
            </div>
          )}

          {/* Divider */}
          <div style={{ borderTop: '1px solid #e5e7eb' }}></div>

          {/* New Preset Section */}
          {!showNewPreset ? (
            <button
              onClick={() => setShowNewPreset(true)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#f0fdf4',
                color: '#16a34a',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '0.9rem',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#dcfce7';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#f0fdf4';
              }}
            >
              + Save Current Filters
            </button>
          ) : (
            <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb' }}>
              <input
                autoFocus
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleSavePreset();
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleSavePreset}
                  style={{
                    flex: 1,
                    padding: '6px',
                    backgroundColor: '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '0.85rem'
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowNewPreset(false);
                    setPresetName('');
                  }}
                  style={{
                    flex: 1,
                    padding: '6px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '0.85rem'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FilterPresetManager;
