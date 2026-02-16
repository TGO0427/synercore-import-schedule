import React, { useState } from 'react';
import { authUtils } from '../utils/auth';

function HelpGuide({ onClose }) {
  const [activeSection, setActiveSection] = useState('getting-started');
  const user = authUtils.getUser();
  const isAdmin = user?.role === 'admin';

  const sections = {
    'getting-started': 'Getting Started',
    'shipping': 'Shipping Schedule',
    'warehouse': 'Warehouse Capacity',
    'suppliers': 'Supplier Management',
    'workflow': 'Post-Arrival Workflow',
    'reports': 'Reports & Analytics',
    'settings': 'User Settings',
    ...(isAdmin ? { 'admin': 'Admin Functions' } : {})
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'getting-started':
        return (
          <div>
            <h2>🚀 Getting Started</h2>
            <p>Welcome to the Synercore Import Schedule Management System!</p>

            <h3>First Time Login</h3>
            <ol>
              <li>Login with your username and temporary password</li>
              <li>Click <strong>👤 User Settings</strong> in the sidebar</li>
              <li>Change your password to something secure</li>
              <li>You'll be logged out automatically - login with your new password</li>
            </ol>

            <h3>Navigation</h3>
            <p>Use the sidebar menu to access different sections:</p>
            <ul>
              <li><strong>🏢 Suppliers</strong> - Manage supplier information</li>
              <li><strong>🏭 Warehouse Capacity</strong> - Monitor warehouse utilization</li>
              <li><strong>📋 Product & Warehouse</strong> - View products and warehouse assignments</li>
              <li><strong>📦 Shipping Schedule</strong> - Track all shipments</li>
              <li><strong>📋 Post-Arrival Workflow</strong> - Manage unloading, inspection, receiving</li>
              <li><strong>📊 Reports</strong> - Generate analytics and exports</li>
              <li><strong>📈 Advanced Reports</strong> - Custom filters and data analysis</li>
              <li><strong>📦 Shipment Archives</strong> - Access archived shipments</li>
              <li><strong>💰 Rates & Quotes</strong> - Get shipping quotes</li>
              <li><strong>🏪 Warehouse Stored</strong> - View stored inventory</li>
            </ul>

            <h3>Quick Actions</h3>
            <ul>
              <li><strong>🔔 Alerts</strong> - View system notifications and warnings</li>
              <li><strong>📥 Upload Excel</strong> - Import bulk shipment data</li>
              <li><strong>👤 User Settings</strong> - Change password and view profile</li>
              <li><strong>🚪 Logout</strong> - Securely logout of the system</li>
            </ul>
          </div>
        );

      case 'shipping':
        return (
          <div>
            <h2>📦 Shipping Schedule</h2>

            <h3>Overview</h3>
            <p>The Shipping Schedule is your central hub for tracking all shipments from planning to arrival.</p>

            <h3>Shipment Status Flow</h3>
            <ol>
              <li><strong>Planned</strong> - Airfreight or Seafreight shipments in planning</li>
              <li><strong>In Transit</strong> - Currently being transported (Airfreight, Roadway, Seaway)</li>
              <li><strong>Arrived</strong> - Reached destination warehouse (PTA or KLM)</li>
              <li><strong>Unloading</strong> - Being unloaded from transport</li>
              <li><strong>Inspection</strong> - Quality and quantity inspection in progress</li>
              <li><strong>Receiving</strong> - Being checked into inventory</li>
              <li><strong>Stored</strong> - Completed and stored in warehouse</li>
            </ol>

            <h3>Adding Shipments</h3>
            <ul>
              <li><strong>Manual Entry</strong> - Click "Add Shipment" button and fill in details</li>
              <li><strong>Excel Upload</strong> - Click "Upload Excel" to import multiple shipments</li>
              <li><strong>Email Import</strong> - System can process forwarding agent emails</li>
            </ul>

            <h3>Editing Shipments</h3>
            <ol>
              <li>Click on any shipment row</li>
              <li>Edit the fields you need to change</li>
              <li>Changes are saved automatically</li>
              <li>Status updates trigger workflow changes</li>
            </ol>

            <h3>Key Fields</h3>
            <ul>
              <li><strong>Order Ref</strong> - Your internal order reference</li>
              <li><strong>Supplier</strong> - Select from supplier list</li>
              <li><strong>Product Name</strong> - What's being shipped</li>
              <li><strong>Quantity</strong> - Amount (tonnage)</li>
              <li><strong>CBM / Pallet Qty</strong> - Volume or pallet count</li>
              <li><strong>Week Number</strong> - Expected arrival week</li>
              <li><strong>Final POD</strong> - Destination warehouse</li>
              <li><strong>Status</strong> - Current shipment status</li>
            </ul>

            <h3>Tips</h3>
            <ul>
              <li>Use filters to focus on specific statuses</li>
              <li>Sort columns by clicking headers</li>
              <li>Export data using the Reports section</li>
              <li>Archive old shipments to keep the view clean</li>
            </ul>
          </div>
        );

      case 'warehouse':
        return (
          <div>
            <h2>🏭 Warehouse Capacity Management</h2>

            <h3>Overview</h3>
            <p>Monitor and manage warehouse utilization to prevent overcapacity and optimize storage.</p>

            <h3>Understanding Capacity Cards</h3>
            <p>Each warehouse shows:</p>
            <ul>
              <li><strong>Bin Utilization %</strong> - How full the warehouse is</li>
              <li><strong>Current Bins Utilized</strong> - Bins currently in use (editable)</li>
              <li><strong>Incoming</strong> - Pallets arriving this month</li>
              <li><strong>Total Bins</strong> - Maximum warehouse capacity</li>
              <li><strong>Available Bins</strong> - Remaining capacity</li>
            </ul>

            <h3>Status Indicators</h3>
            <ul>
              <li><strong style={{color: '#f44336'}}>Over Capacity</strong> - ≥95% full (Red)</li>
              <li><strong style={{color: '#ff9800'}}>Near Capacity</strong> - 80-95% full (Orange)</li>
              <li><strong style={{color: '#4caf50'}}>Good Utilization</strong> - 60-80% full (Green)</li>
              <li><strong style={{color: '#2196f3'}}>Under Utilized</strong> - &lt;60% full (Blue)</li>
            </ul>

            <h3>Updating Current Bins</h3>
            <ol>
              <li>Scroll to the <strong>📝 Edit Current Bins Utilized</strong> panel at the top</li>
              <li>Enter the actual number of bins currently in use for each warehouse</li>
              <li>Fields with pending changes show orange highlight</li>
              <li>Click <strong>"💾 Save All Changes"</strong> button to save</li>
              <li>Changes are saved with your username for audit trail</li>
            </ol>

            <h3>Weekly Capacity Inflow</h3>
            <p>The table shows incoming pallets by week for the current month, helping you plan capacity needs.</p>

            <h3>Export Reports</h3>
            <p>Click "Export Warehouse Capacity PDF" to generate a detailed capacity report with:</p>
            <ul>
              <li>Current capacity status for all warehouses</li>
              <li>Weekly incoming pallets breakdown</li>
              <li>Capacity utilization charts</li>
              <li>Incoming products summary</li>
            </ul>

            <h3>Important Notes</h3>
            <ul>
              <li>✅ All changes are tracked with audit trail</li>
              <li>✅ Data syncs across all users in real-time</li>
              <li>✅ History of changes is maintained</li>
            </ul>
          </div>
        );

      case 'suppliers':
        return (
          <div>
            <h2>🏢 Supplier Management</h2>

            <h3>Overview</h3>
            <p>Manage your supplier database with contact information and documentation.</p>

            <h3>Adding Suppliers</h3>
            <ol>
              <li>Click "Add New Supplier" button</li>
              <li>Fill in supplier details:
                <ul>
                  <li>Company Name (required)</li>
                  <li>Contact Person</li>
                  <li>Email Address</li>
                  <li>Phone Number</li>
                  <li>Physical Address</li>
                  <li>Country</li>
                  <li>Notes</li>
                </ul>
              </li>
              <li>Click "Add Supplier"</li>
            </ol>

            <h3>Editing Suppliers</h3>
            <ul>
              <li>Click "Edit" button on any supplier</li>
              <li>Update information</li>
              <li>Click "Update Supplier"</li>
            </ul>

            <h3>Document Management</h3>
            <p>Upload supplier documents (certificates, agreements, etc.):</p>
            <ol>
              <li>Click "Documents" on supplier row</li>
              <li>Drag & drop files or click to browse</li>
              <li>Supports: PDF, Word, Excel, Images</li>
              <li>View or download documents anytime</li>
            </ol>

            <h3>Searching Suppliers</h3>
            <ul>
              <li>Use the search box to find suppliers by name</li>
              <li>Real-time filtering as you type</li>
            </ul>
          </div>
        );

      case 'workflow':
        return (
          <div>
            <h2>📋 Post-Arrival Workflow</h2>

            <h3>Overview</h3>
            <p>Manage the complete post-arrival process from unloading to storage.</p>

            <h3>Workflow Stages</h3>

            <h4>1. Unloading</h4>
            <ul>
              <li>Click "Start Unloading" when shipment arrives</li>
              <li>Records start time automatically</li>
              <li>Click "Complete Unloading" when done</li>
              <li>Automatically moves to Inspection stage</li>
            </ul>

            <h4>2. Inspection</h4>
            <ul>
              <li>Click "Start Inspection"</li>
              <li>Inspect quality and quantity</li>
              <li>Add inspection notes</li>
              <li>Mark as Passed, Failed, or Pending</li>
              <li>Record inspector name</li>
            </ul>

            <h4>3. Receiving</h4>
            <ul>
              <li>Click "Start Receiving"</li>
              <li>Enter actual received quantity</li>
              <li>Note any discrepancies</li>
              <li>Mark status (Complete, Partial, Damaged)</li>
              <li>Record receiver name</li>
            </ul>

            <h4>4. Storage</h4>
            <ul>
              <li>Click "Mark as Stored"</li>
              <li>Shipment moves to Stored status</li>
              <li>Available in Warehouse Stored view</li>
            </ul>

            <h3>Tips</h3>
            <ul>
              <li>All timestamps are recorded automatically</li>
              <li>You can add notes at each stage</li>
              <li>Discrepancies are tracked for auditing</li>
              <li>Status updates are visible to all users</li>
            </ul>
          </div>
        );

      case 'reports':
        return (
          <div>
            <h2>📊 Reports & Analytics</h2>

            <h3>Available Reports</h3>

            <h4>Shipment Reports</h4>
            <ul>
              <li><strong>All Shipments</strong> - Complete shipment list</li>
              <li><strong>By Status</strong> - Filter by shipment status</li>
              <li><strong>By Supplier</strong> - Group shipments by supplier</li>
              <li><strong>By Week</strong> - Shipments arriving each week</li>
              <li><strong>Delayed Shipments</strong> - Overdue arrivals</li>
            </ul>

            <h4>Warehouse Reports</h4>
            <ul>
              <li><strong>Capacity Report</strong> - Current utilization</li>
              <li><strong>Incoming Analysis</strong> - Forecast arrivals</li>
              <li><strong>Storage Report</strong> - What's currently stored</li>
            </ul>

            <h4>Export Formats</h4>
            <ul>
              <li><strong>PDF</strong> - Formatted, printable reports</li>
              <li><strong>Excel</strong> - Editable spreadsheets</li>
              <li><strong>CSV</strong> - Data for analysis</li>
            </ul>

            <h3>Generating Reports</h3>
            <ol>
              <li>Go to Reports section</li>
              <li>Select report type</li>
              <li>Choose date range or filters</li>
              <li>Click "Generate Report"</li>
              <li>Download or view in browser</li>
            </ol>

            <h3>Advanced Reports</h3>
            <p>For more powerful analysis, use the <strong>📈 Advanced Reports</strong> module:</p>

            <h4>Custom Filters</h4>
            <p>Apply multiple filters simultaneously:</p>
            <ul>
              <li><strong>Date Range</strong> - Filter by created date, updated date, ETA, or ETD</li>
              <li><strong>Status</strong> - Select multiple shipment statuses</li>
              <li><strong>Warehouse</strong> - Filter by destination warehouse</li>
              <li><strong>Supplier</strong> - Select one or more suppliers</li>
              <li><strong>Product</strong> - Filter by product type</li>
              <li><strong>Week Number</strong> - Filter by arrival week</li>
              <li><strong>Forwarding Agent</strong> - Filter by shipping agent</li>
              <li><strong>Incoterms</strong> - Filter by shipping terms</li>
              <li><strong>Vessel Name</strong> - Filter by specific vessel</li>
              <li><strong>Priority Level</strong> - Filter by urgency</li>
              <li><strong>Inspection Status</strong> - Filter by quality check status</li>
              <li><strong>Receiving Status</strong> - Filter by receiving status</li>
              <li><strong>Quantity Range</strong> - Filter by min/max quantity</li>
              <li><strong>Pallet Range</strong> - Filter by min/max pallet count</li>
              <li><strong>Search Term</strong> - Free text search across multiple fields</li>
            </ul>

            <h4>Data Aggregation</h4>
            <p>Group and analyze your data by:</p>
            <ul>
              <li><strong>Supplier</strong> - Total shipments, quantities, and pallets per supplier</li>
              <li><strong>Warehouse</strong> - Analyze distribution across warehouses</li>
              <li><strong>Status</strong> - See counts and totals per shipment status</li>
              <li><strong>Product</strong> - Aggregate by product type</li>
              <li><strong>Week</strong> - Group by arrival week for trend analysis</li>
              <li><strong>Month</strong> - Monthly aggregation for long-term planning</li>
              <li><strong>Forwarding Agent</strong> - Compare agent performance</li>
            </ul>

            <h4>Metrics Displayed</h4>
            <p>Each aggregation shows:</p>
            <ul>
              <li><strong>Count</strong> - Number of shipments in group</li>
              <li><strong>Total Quantity</strong> - Sum of all quantities (tonnage)</li>
              <li><strong>Total Pallets</strong> - Sum of all pallets</li>
              <li><strong>Average Quantity</strong> - Mean quantity per shipment</li>
            </ul>

            <h4>Export Options</h4>
            <ul>
              <li><strong>📊 Export Excel</strong> - Multi-sheet workbook with summary and data</li>
              <li><strong>📄 Export PDF</strong> - Formatted report for printing and sharing</li>
            </ul>

            <h4>Important Notes</h4>
            <ul>
              <li>✅ Planned shipments always appear at the bottom of the list</li>
              <li>✅ Week numbers are displayed for easy time-based analysis</li>
              <li>✅ Filters can be combined for very specific queries</li>
              <li>✅ Excel exports include both summary and detail sheets</li>
            </ul>

            <h3>Scheduled Reports</h3>
            <p>Contact your administrator to set up automated daily/weekly reports via email.</p>
          </div>
        );

      case 'settings':
        return (
          <div>
            <h2>👤 User Settings</h2>

            <h3>Changing Your Password</h3>
            <ol>
              <li>Click <strong>👤 User Settings</strong> in sidebar</li>
              <li>Enter your current password</li>
              <li>Enter new password (minimum 6 characters)</li>
              <li>Confirm new password</li>
              <li>Click "Change Password"</li>
              <li>You'll be logged out - login with new password</li>
            </ol>

            <h3>Password Requirements</h3>
            <ul>
              <li>Minimum 6 characters</li>
              <li>Recommended: Mix of letters, numbers, symbols</li>
              <li>Don't share your password with anyone</li>
              <li>Change regularly for security</li>
            </ul>

            <h3>Profile Information</h3>
            <p>View your account details:</p>
            <ul>
              <li>Username</li>
              <li>Email address</li>
              <li>Full name</li>
              <li>Account role (User or Admin)</li>
            </ul>

            <h3>Security Tips</h3>
            <ul>
              <li>✅ Always logout when leaving your computer</li>
              <li>✅ Don't save passwords in browser if using shared computer</li>
              <li>✅ Report suspicious activity to your administrator</li>
              <li>✅ Session expires after 7 days - you'll need to login again</li>
            </ul>
          </div>
        );

      case 'admin':
        return isAdmin ? (
          <div>
            <h2>🔐 Admin Functions</h2>

            <h3>Creating User Accounts</h3>
            <p>To create a new user account:</p>
            <ol>
              <li>Login to the system</li>
              <li>Open browser console (F12)</li>
              <li>Copy and paste this code:</li>
            </ol>
            <pre style={{
              backgroundColor: '#f5f5f5',
              padding: '15px',
              borderRadius: '6px',
              overflow: 'auto',
              fontSize: '12px',
              border: '1px solid #ddd'
            }}>
{`const token = localStorage.getItem('auth_token');

fetch('YOUR_API_URL/api/auth/admin/create-user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${token}\`
  },
  body: JSON.stringify({
    username: 'employee_username',
    password: 'temporary123',
    email: 'employee@company.com',
    fullName: 'Employee Name',
    role: 'user'  // or 'admin'
  })
}).then(r => r.json()).then(console.log)`}
            </pre>

            <h3>First-Time User Setup</h3>
            <p>When you create a user, give them:</p>
            <ul>
              <li><strong>Username:</strong> Their unique username</li>
              <li><strong>Temporary Password:</strong> temporary123</li>
              <li><strong>Instructions:</strong> Tell them to change password on first login via User Settings</li>
            </ul>

            <h3>User Roles</h3>
            <ul>
              <li><strong>user</strong> - Regular user, can update warehouse capacity and view data</li>
              <li><strong>admin</strong> - Full access, can create users and view all audit trails</li>
            </ul>

            <h3>Viewing Audit Trail</h3>
            <p>To view who changed warehouse capacity:</p>
            <ol>
              <li>Open browser console (F12)</li>
              <li>Run this code:</li>
            </ol>
            <pre style={{
              backgroundColor: '#f5f5f5',
              padding: '15px',
              borderRadius: '6px',
              overflow: 'auto',
              fontSize: '12px',
              border: '1px solid #ddd'
            }}>
{`const token = localStorage.getItem('auth_token');

// View history for specific warehouse
fetch('YOUR_API_URL/api/warehouse-capacity/KLAPMUTS/history', {
  headers: { 'Authorization': \`Bearer \${token}\` }
}).then(r => r.json()).then(console.log)

// View all changes (admin only)
fetch('YOUR_API_URL/api/warehouse-capacity/history/all', {
  headers: { 'Authorization': \`Bearer \${token}\` }
}).then(r => r.json()).then(console.log)`}
            </pre>

            <h3>Managing Shipments</h3>
            <ul>
              <li>Archive old shipments to keep database clean</li>
              <li>Use bulk import for large datasets</li>
              <li>Export regular backups via Reports</li>
              <li>Monitor database size in Railway dashboard</li>
            </ul>

            <h3>System Maintenance</h3>
            <ul>
              <li><strong>Database:</strong> PostgreSQL hosted on Railway</li>
              <li><strong>Frontend:</strong> Deployed on Vercel</li>
              <li><strong>Backend:</strong> Node.js API on Railway</li>
              <li><strong>Backups:</strong> Automated daily backups in Railway</li>
            </ul>

            <h3>Support & Documentation</h3>
            <ul>
              <li>Full documentation in <code>AUTH_SETUP.md</code></li>
              <li>API endpoints documented in code</li>
              <li>Contact developer for advanced features</li>
            </ul>
          </div>
        ) : null;

      default:
        return <p>Section not found</p>;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '1200px',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 30px',
          borderBottom: '2px solid #e1e5e9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '24px' }}>
            📚 Help & User Guide
          </h1>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#666',
              padding: '5px 10px'
            }}
          >
            ×
          </button>
        </div>

        {/* Content Area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar Navigation */}
          <div style={{
            width: '250px',
            borderRight: '1px solid #e1e5e9',
            overflowY: 'auto',
            padding: '20px 0'
          }}>
            {Object.entries(sections).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  border: 'none',
                  backgroundColor: activeSection === key ? '#059669' : 'transparent',
                  color: activeSection === key ? 'white' : '#2c3e50',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: activeSection === key ? '600' : '400',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== key) {
                    e.target.style.backgroundColor = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== key) {
                    e.target.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '30px'
          }}>
            <div style={{
              maxWidth: '800px',
              lineHeight: '1.6',
              color: '#333'
            }}>
              {renderContent()}
            </div>
          </div>
        </div>

        <style>{`
          h2 { color: #2c3e50; margin-top: 0; margin-bottom: 15px; }
          h3 { color: #34495e; margin-top: 25px; margin-bottom: 10px; font-size: 18px; }
          h4 { color: #34495e; margin-top: 20px; margin-bottom: 8px; font-size: 16px; }
          p { margin-bottom: 12px; }
          ul, ol { margin-bottom: 15px; padding-left: 25px; }
          li { margin-bottom: 8px; }
          code { background-color: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
          strong { color: #2c3e50; }
        `}</style>
      </div>
    </div>
  );
}

export default HelpGuide;
