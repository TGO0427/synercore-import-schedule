import React, { useState } from 'react';

export function EmailEstimateModal({ isOpen, estimate, onClose, onSend }) {
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  if (!isOpen || !estimate) return null;

  const handleSend = async () => {
    if (!emailTo) return;
    setEmailSending(true);
    try {
      await onSend(emailTo, estimate);
      setEmailTo('');
    } finally {
      setEmailSending(false);
    }
  };

  const handleClose = () => {
    setEmailTo('');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
      alignItems: 'center', zIndex: 2000
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem',
        width: '100%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      }}>
        <h3 style={{ margin: '0 0 1rem', color: '#0f172a' }}>Send Cost Estimate via Email</h3>

        <div style={{ marginBottom: '1rem', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-500)' }}>Reference</div>
          <div style={{ fontWeight: '600' }}>{estimate.reference_number || estimate.id}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-500)', marginTop: '8px' }}>Supplier</div>
          <div style={{ fontWeight: '600' }}>{estimate.supplier_name || 'N/A'}</div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-900)' }}>
            Send to Email Address
          </label>
          <input
            type="email"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="colleague@company.com"
            style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.95rem' }}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleClose}
            style={{ padding: '10px 20px', backgroundColor: '#f3f4f6', color: 'var(--text-900)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
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
  );
}

export function RequestCostingModal({ isOpen, onClose, onSubmit }) {
  const [requestForm, setRequestForm] = useState({ supplier_name: '', product_description: '', priority: 'normal', notes: '' });
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setRequestSubmitting(true);
    try {
      await onSubmit(requestForm);
      setRequestForm({ supplier_name: '', product_description: '', priority: 'normal', notes: '' });
    } finally {
      setRequestSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
      alignItems: 'stretch', zIndex: 2000
    }}>
      <div style={{
        backgroundColor: 'white', width: '100vw', height: '100vh',
        overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10
        }}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a' }}>Request a Costing</h3>
            <p style={{ color: 'var(--text-500)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              Submit a request and an admin will prepare the cost estimate for you.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: '1.5rem', maxWidth: '700px' }}>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: '500', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Supplier Name</label>
            <input
              type="text"
              value={requestForm.supplier_name}
              onChange={(e) => setRequestForm(prev => ({ ...prev, supplier_name: e.target.value }))}
              placeholder="e.g. ABC Trading Co."
              className="input"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: '500', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Product / Description</label>
            <textarea
              value={requestForm.product_description}
              onChange={(e) => setRequestForm(prev => ({ ...prev, product_description: e.target.value }))}
              placeholder="Describe the product(s) you need costed..."
              rows={3}
              className="input"
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: '500', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Priority</label>
            <select
              value={requestForm.priority}
              onChange={(e) => setRequestForm(prev => ({ ...prev, priority: e.target.value }))}
              className="select"
              style={{ width: '100%' }}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: '500', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Additional Notes</label>
            <textarea
              value={requestForm.notes}
              onChange={(e) => setRequestForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional context, deadlines, or details..."
              rows={2}
              className="input"
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 20px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={requestSubmitting}
            style={{
              padding: '10px 20px', backgroundColor: requestSubmitting ? '#9ca3af' : '#f59e0b', color: 'white',
              border: 'none', borderRadius: '6px', cursor: requestSubmitting ? 'not-allowed' : 'pointer', fontWeight: '500'
            }}
          >
            {requestSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
