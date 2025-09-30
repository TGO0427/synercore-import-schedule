// src/components/Header.jsx
import SynercoreLogo from './SynercoreLogo';

export default function Header() {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start', // left
        gap: 12,
        padding: '12px 16px',
        width: '100%',                 // make header span full width
      }}
    >
      {/* NEVER give the logo margin:auto — that centers it */}
      <SynercoreLogo size={48} />
      <h1 style={{ margin: 0, fontSize: 18 }}>Dashboard</h1>

      {/* This pushes ONLY the right section to the edge, not the logo */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {/* actions */}
      </div>
    </header>
  );
}
