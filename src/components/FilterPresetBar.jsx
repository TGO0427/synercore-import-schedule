import React, { useState, useEffect } from 'react';
import { filterPreferencesManager } from '../utils/filterPreferences';

function FilterPresetBar({ viewName, currentFilters, onLoadPreset }) {
  const [presets, setPresets] = useState({});
  const [presetName, setPresetName] = useState('');
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    setPresets(filterPreferencesManager.getPresets(viewName));
  }, [viewName]);

  const handleSave = () => {
    if (!presetName.trim()) return;
    filterPreferencesManager.savePreset(viewName, presetName.trim(), currentFilters);
    setPresets(filterPreferencesManager.getPresets(viewName));
    setPresetName('');
    setShowSave(false);
  };

  const handleLoad = (name) => {
    const filters = filterPreferencesManager.loadPreset(viewName, name);
    if (filters && onLoadPreset) {
      onLoadPreset(filters);
    }
  };

  const handleDelete = (name, e) => {
    e.stopPropagation();
    filterPreferencesManager.deletePreset(viewName, name);
    setPresets(filterPreferencesManager.getPresets(viewName));
  };

  const presetNames = Object.keys(presets);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
      padding: '8px 0', fontSize: '0.85rem'
    }}>
      <span style={{ color: 'var(--text-500)', fontWeight: 500, fontSize: '0.8rem' }}>Presets:</span>

      {presetNames.map(name => (
        <button
          key={name}
          onClick={() => handleLoad(name)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text-700)', cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          {name}
          <span
            onClick={(e) => handleDelete(name, e)}
            style={{
              marginLeft: '4px', fontSize: '0.7rem', color: 'var(--text-500)',
              cursor: 'pointer', lineHeight: 1,
            }}
            title="Delete preset"
          >
            ✕
          </span>
        </button>
      ))}

      {showSave ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSave(false); }}
            placeholder="Preset name..."
            autoFocus
            style={{
              padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text-900)', width: '120px',
            }}
          />
          <button
            onClick={handleSave}
            disabled={!presetName.trim()}
            style={{
              padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem',
              background: 'var(--accent)', color: 'white', border: 'none',
              cursor: presetName.trim() ? 'pointer' : 'default',
              opacity: presetName.trim() ? 1 : 0.5,
            }}
          >
            Save
          </button>
          <button
            onClick={() => { setShowSave(false); setPresetName(''); }}
            style={{
              padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem',
              background: 'transparent', color: 'var(--text-500)', border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSave(true)}
          style={{
            padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem',
            background: 'transparent', border: '1px dashed var(--border)',
            color: 'var(--text-500)', cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent-100)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-500)'; }}
        >
          + Save Current
        </button>
      )}
    </div>
  );
}

export default FilterPresetBar;
