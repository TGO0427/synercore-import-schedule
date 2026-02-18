import React, { useState, useRef, useEffect, useCallback } from 'react';

function GlobalSearch({ shipments, onNavigate }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = useCallback(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const seen = new Set();
    return shipments
      .filter(s => {
        const match =
          s.orderRef?.toLowerCase().includes(q) ||
          s.supplier?.toLowerCase().includes(q) ||
          s.finalPod?.toLowerCase().includes(q) ||
          s.vesselName?.toLowerCase().includes(q);
        if (!match || seen.has(s.orderRef)) return false;
        seen.add(s.orderRef);
        return true;
      })
      .slice(0, 8);
  }, [query, shipments])();

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  const handleSelect = (shipment) => {
    setOpen(false);
    setQuery('');
    onNavigate('shipping', { searchTerm: shipment.orderRef });
  };

  const getStatusPill = (status) => {
    const s = status || '';
    if (s.includes('delayed')) return { cls: 'pill pill-bad', label: 'Delayed' };
    if (s.includes('arrived')) return { cls: 'pill pill-ok', label: 'Arrived' };
    if (s.includes('in_transit') || s.includes('seaway') || s.includes('roadway')) return { cls: 'pill pill-info', label: 'In Transit' };
    if (s.includes('planned')) return { cls: 'pill pill-warn', label: 'Planned' };
    if (s.includes('moored') || s.includes('berth')) return { cls: 'pill pill-info', label: 'Port' };
    return { cls: 'pill pill-info', label: s.replace(/_/g, ' ') };
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: '0 1 320px' }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setSelectedIndex(0);
        }}
        onFocus={() => query.length >= 2 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search orders, suppliers, vessels..."
        aria-label="Search shipments"
        aria-expanded={open && results.length > 0}
        aria-controls="global-search-results"
        aria-autocomplete="list"
        role="combobox"
        className="input"
        style={{
          width: '100%',
          padding: '7px 12px 7px 32px',
          fontSize: '0.85rem',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
        }}
      />
      <span style={{
        position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
        fontSize: '0.85rem', color: 'var(--text-500)', pointerEvents: 'none',
      }}>
        🔍
      </span>

      {open && results.length > 0 && (
        <div id="global-search-results" role="listbox" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '10px', boxShadow: 'var(--shadow-2)', zIndex: 100,
          maxHeight: '320px', overflowY: 'auto',
        }}>
          {results.map((shipment, idx) => {
            const pill = getStatusPill(shipment.latestStatus);
            return (
              <div
                key={shipment.id}
                role="option"
                aria-selected={idx === selectedIndex}
                onClick={() => handleSelect(shipment)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  padding: '10px 14px', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                  backgroundColor: idx === selectedIndex ? 'var(--accent-100)' : 'transparent',
                  borderBottom: idx < results.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-900)' }}>
                    {shipment.orderRef}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {shipment.supplier} — {shipment.finalPod}
                  </div>
                </div>
                <span className={pill.cls} style={{ fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                  {pill.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '10px', boxShadow: 'var(--shadow-2)', zIndex: 100,
          padding: '16px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-500)',
        }}>
          No results found
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;
