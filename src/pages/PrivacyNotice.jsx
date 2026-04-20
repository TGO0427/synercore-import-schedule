import React from 'react';

export default function PrivacyNotice({ onBack }) {
  const sectionStyle = { marginBottom: '20px' };
  const h2Style = { fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '6px' };
  const pStyle = { fontSize: '14px', color: '#374151', lineHeight: 1.55, margin: 0 };
  const listStyle = { fontSize: '14px', color: '#374151', lineHeight: 1.55, margin: '6px 0 0 20px' };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '40px 20px' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto', backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#059669', marginTop: 0, marginBottom: '8px' }}>
          Privacy Notice
        </h1>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px' }}>
          Synercore Import Schedule — last updated 20 April 2026
        </p>

        <div style={sectionStyle}>
          <h2 style={h2Style}>What this notice covers</h2>
          <p style={pStyle}>
            This notice describes how the Synercore Import Schedule application collects, uses, and protects personal information in terms of the Protection of Personal Information Act, 2013 (POPIA).
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Who is the responsible party</h2>
          <p style={pStyle}>
            Synercore Holdings (Pty) Ltd is the responsible party for personal information processed through this application. Questions or requests can be directed to the administrator listed in your account settings.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>What information we collect</h2>
          <ul style={listStyle}>
            <li>Account details: username, email address, full name, hashed password.</li>
            <li>Login activity: IP address, browser / device, date and time of sign-in attempts.</li>
            <li>Supplier contact details (where you are a supplier): company name, contact person, email, phone, country.</li>
            <li>Documents you upload against shipments (proof of delivery, invoices, customs papers).</li>
            <li>Audit log: actions you take inside the application (create / update / archive shipments etc.).</li>
          </ul>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Why we collect it</h2>
          <ul style={listStyle}>
            <li>To authenticate you and secure your account.</li>
            <li>To operate the import scheduling, costing, and warehouse workflows.</li>
            <li>To meet customs, tax, and other legal record-keeping obligations.</li>
            <li>To detect and investigate unauthorised access.</li>
          </ul>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Who we share it with</h2>
          <p style={pStyle}>
            Personal information is processed by the following operators on our behalf:
          </p>
          <ul style={listStyle}>
            <li>Railway (application hosting, PostgreSQL database).</li>
            <li>Vercel (frontend hosting).</li>
            <li>Sentry (error monitoring).</li>
          </ul>
          <p style={pStyle}>
            These operators may store data in regions outside South Africa. We do not sell personal information or share it with third parties for marketing.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>How long we keep it</h2>
          <ul style={listStyle}>
            <li>Login activity: 365 days.</li>
            <li>Expired refresh tokens: 30 days after expiry.</li>
            <li>Pending registrations that are never approved: 90 days.</li>
            <li>Shipment records and supporting documents: retained for the period required by customs and tax legislation.</li>
            <li>Audit log entries: retained for operational and legal-record integrity even after a user account is erased.</li>
          </ul>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Your rights under POPIA</h2>
          <ul style={listStyle}>
            <li><strong>Access</strong> — download a copy of the personal information held about you from your account settings.</li>
            <li><strong>Correction</strong> — request that inaccurate information be corrected.</li>
            <li><strong>Deletion</strong> — request that your personal information be erased; operational and legal records will be retained in anonymised form where required.</li>
            <li><strong>Objection</strong> — object to processing in specific circumstances.</li>
            <li><strong>Complaint</strong> — lodge a complaint with the Information Regulator (South Africa).</li>
          </ul>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Security</h2>
          <p style={pStyle}>
            Passwords are hashed, connections are encrypted in transit with TLS, access is restricted by role-based permissions, and administrative actions are logged. Despite these measures, no system can be guaranteed entirely secure — please report suspected security incidents to the administrator immediately.
          </p>
        </div>

        <div style={{ marginTop: '28px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: '#059669',
              color: 'white',
              border: 'none',
              padding: '10px 22px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
