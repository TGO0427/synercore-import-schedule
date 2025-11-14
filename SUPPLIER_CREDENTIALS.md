# Supplier Portal Credentials

## 📋 Overview

All suppliers have been auto-registered in the Supplier Portal with secure credentials. They can now login to view shipments, upload documents, and access real-time analytics.

**Last Updated**: 2024-11-14
**Total Suppliers Registered**: 9
**Registration Date**: Generated via bulk registration script

---

## 🔐 Login Credentials

### **How Suppliers Login**

1. Navigate to: `https://your-domain.com/supplier` (or `/supplier` locally)
2. Click **🔑 Login** tab
3. Enter **Email** and **Password**
4. Click **🔓 Login**

---

## 👥 Supplier Accounts

### 1. **Qida**
```
Supplier ID:  1757586493291
Email:        admin@qida.supplier
Password:     CazHyqm$jnz^ng@b
Status:       ✅ Active
```

### 2. **Futura**
```
Supplier ID:  1757595445950
Email:        admin@futura.supplier
Password:     JhjXih5M5oRxf*nV
Status:       ✅ Active
```

### 3. **Aromsa**
```
Supplier ID:  1757595542547
Email:        admin@aromsa.supplier
Password:     yiNE^h@bUvRVBJJl
Status:       ✅ Active
```

### 4. **Halavet**
```
Supplier ID:  1757595679656
Email:        admin@halavet.supplier
Password:     !bLcUTCDwzlEhJfp
Status:       ✅ Active
```

### 5. **Deltaris**
```
Supplier ID:  1757595897986
Email:        admin@deltaris.supplier
Password:     FX^VqM^hocQH*Y%h
Status:       ✅ Active
```

### 6. **AB Mauri**
```
Supplier ID:  1757596022056
Email:        admin@ab.mauri.supplier
Password:     Ue2J5sQ!z#H^ZnRv
Status:       ✅ Active
```

### 7. **Sacco**
```
Supplier ID:  1757939504884
Email:        admin@sacco.supplier
Password:     45rT*P#e7ZWlYO%O
Status:       ✅ Active
```

### 8. **Marcel Trading**
```
Supplier ID:  1758115669380
Email:        admin@marcel.trading.supplier
Password:     zGB@47loyCOQlH6j
Status:       ✅ Active
```

### 9. **Shakti Chemicals**
```
Supplier ID:  1758634528638
Email:        shakti@example.com
Password:     TestPassword123 (or your custom password)
Status:       ✅ Active
```

---

## 📖 Registration Instructions (For Reference)

### For Suppliers (Self-Registration)

If a supplier needs to **manually register**:

1. Go to `/supplier`
2. Click **📝 Register** tab
3. Fill in the form:
   - **Supplier ID**: Your company's ID in the system
   - **Company Name** (optional): Your company name
   - **Email**: Your email address
   - **Password**: At least 8 characters
   - **Confirm Password**: Must match
4. Click **✍️ Create Account**
5. Go back to **🔑 Login** tab
6. Login with your email and password

### For Admins (Bulk Registration)

Run the bulk registration script to auto-register all suppliers:

```bash
node server/scripts/bulkRegisterSuppliers.js
```

This will:
- ✅ Register all suppliers automatically
- ✅ Generate secure 16-character passwords
- ✅ Create email addresses from supplier names
- ✅ Display all credentials for distribution

---

## 🎯 Features Available to Suppliers

Once logged in, suppliers can:

### 📦 **View Shipments**
- See all their shipments
- Filter by status (Planned, In Transit, Arrived, etc.)
- Click to view detailed information
- Track delivery progress

### 📄 **Upload Documents**
- **POD** (Proof of Delivery)
- **Delivery Proof** (Tracking information)
- **Customs Documents** (Import/export paperwork)
- **Other** (Additional documents)
- Max file size: 50MB per document

### 📊 **View Reports**
- Total shipments count
- Delivered shipments count
- In-transit shipments count
- Documents uploaded count
- Status breakdown charts
- Delivery timeline statistics

### 📝 **Account Management**
- View account information
- Logout securely
- Return to main app (if accessed from admin sidebar)

---

## 🔒 Security Notes

### Password Management
- **Passwords are hashed** with bcrypt (never stored in plain text)
- **16-character passwords** generated for auto-registered suppliers
- **Minimum 8 characters** required for manual registration
- **Should be changed** on first login for security

### Email Verification
- All accounts are **pre-verified** (no email confirmation needed)
- Email addresses are **unique** (no duplicates allowed)
- Email format: `admin@[supplier-name].supplier` for auto-generated accounts

### Account Status
- All accounts are **active** by default
- Accounts **cannot be deleted** (can be deactivated if needed)
- **Read-only access** - suppliers cannot modify their shipments
- **No editing/deleting** - suppliers can only view and upload

---

## 📧 Communication Template

Use this template to communicate credentials to suppliers:

```
Subject: Synercore Supplier Portal Access

Dear [Supplier Name],

We're pleased to inform you that your company has been registered
in our new Supplier Portal!

📦 PORTAL ACCESS
URL: https://synercore.com/supplier

🔐 YOUR LOGIN CREDENTIALS
Email:    [email]
Password: [password]

🎯 WHAT YOU CAN DO
✅ View all your shipments in real-time
✅ Upload delivery proofs and customs documents
✅ Access performance reports and analytics
✅ Track delivery timelines

🔒 SECURITY
Please change your password on first login for security.
Do not share your credentials with anyone.

📞 SUPPORT
If you have any issues, contact: support@synercore.com

Best regards,
Synercore Team
```

---

## ✅ Testing Checklist

Use these credentials to test the Supplier Portal:

- [ ] Login with Qida account
- [ ] View shipments list
- [ ] Click on a shipment to view details
- [ ] Upload a test document
- [ ] View Reports tab
- [ ] Verify password visibility toggle (👁️ icon)
- [ ] Test Back button (← Back to Main App)
- [ ] Logout and re-login with different supplier
- [ ] Test on mobile device (responsive design)

---

## 🔄 Password Reset

**Current System**: No self-service password reset
**To Reset a Password**: Admin must update database directly or run bulk registration again

Future enhancement: Implement "Forgot Password" functionality

---

## 📊 Registration Summary

| Status | Count |
|--------|-------|
| ✅ Newly Registered | 8 |
| ✅ Already Active | 1 |
| 📦 Total Suppliers | 9 |

**Database Tables**:
- `supplier_accounts` - Login credentials
- `supplier_documents` - Uploaded documents
- `suppliers` - Supplier master data

---

## 🚀 Next Steps

1. **Share credentials** with each supplier via secure email
2. **Instruct them** to login and change their password
3. **Monitor usage** via admin dashboard
4. **Collect feedback** on portal experience
5. **Plan enhancements** based on supplier needs

---

## 📞 Support

**For Suppliers**:
- Contact: support@synercore.com
- Issue: Cannot login, forgotten password, document upload errors

**For Admins**:
- Check `supplier_accounts` table for user data
- Check `supplier_documents` table for uploads
- Review server logs for API errors
- Run bulk registration script again to reset all passwords

---

**Last Updated**: 2024-11-14
**Version**: 1.0
**Status**: ✅ Production Ready
