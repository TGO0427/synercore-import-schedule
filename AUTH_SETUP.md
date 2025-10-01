# Authentication & Audit Trail Setup Guide

This system now includes proper user authentication and audit trail tracking for warehouse capacity changes.

## 🔐 Features

- **JWT-based Authentication** - Secure token-based auth with 7-day expiry
- **User Management** - Admin and regular user roles
- **Audit Trail** - Track all warehouse capacity changes with user info
- **History API** - View change history for any warehouse

## 📋 Setup Instructions

### 1. Run Database Migration

The migration will create the necessary tables:
- `users` - User accounts
- `warehouse_capacity` - With `updated_by` tracking
- `warehouse_capacity_history` - Full audit trail

```bash
# Set your DATABASE_URL environment variable (Railway should have this set)
npm run migrate
```

### 2. Create Admin User

After the database is set up, create your first admin user:

```bash
node server/scripts/createAdminUser.js
```

Follow the prompts to create an admin account.

### 3. Environment Variables

Make sure these are set in your deployment (Railway):

```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secure-random-secret-here
```

For Vercel frontend:
```
VITE_API_BASE_URL=https://your-railway-backend.up.railway.app
```

## 🎯 Using the System

### Login

Users must log in with their credentials. The login page will:
1. Authenticate against the database
2. Store a JWT token in localStorage
3. Use the token for all API requests

### Updating Warehouse Capacity

When a user changes the "Current Bins Utilized" value:
1. The system checks for a valid JWT token
2. Records who made the change
3. Saves the previous value
4. Creates an audit trail entry

### Viewing Audit Trail

**For a specific warehouse:**
```bash
GET /api/warehouse-capacity/:warehouseName/history
Authorization: Bearer <token>
```

**For all warehouses (admin only):**
```bash
GET /api/warehouse-capacity/history/all
Authorization: Bearer <token>
```

## 🔒 Security

- Passwords are hashed using bcrypt (10 rounds)
- JWT tokens expire after 7 days
- Warehouse capacity updates require authentication
- History endpoints require authentication
- Admin-only endpoints check user role

## 👥 User Roles

- **admin** - Full access, can view all history
- **user** - Can update warehouse capacity, view specific warehouse history

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user (creates regular user)
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info (requires auth)

### Warehouse Capacity
- `GET /api/warehouse-capacity` - Get all capacity data (public)
- `PUT /api/warehouse-capacity/:name` - Update capacity (requires auth)
- `GET /api/warehouse-capacity/:name/history` - Get warehouse history (requires auth)
- `GET /api/warehouse-capacity/history/all` - Get all history (admin only)

## 🐛 Troubleshooting

**"Your session has expired"**
- The JWT token has expired or is invalid
- User needs to log in again

**"Failed to save changes"**
- Check that DATABASE_URL is set
- Verify the user has a valid token
- Check browser console for detailed errors

**Can't create admin user**
- Make sure DATABASE_URL is set
- Ensure the database migration has run
- Check that the username doesn't already exist

## 📝 Creating Additional Users

Currently, users need to be created manually. You have two options:

1. **Use the script:**
```bash
node server/scripts/createAdminUser.js
# Change the role in the database from 'admin' to 'user' if needed
```

2. **Direct database insert:**
```sql
INSERT INTO users (id, username, email, password_hash, role, is_active)
VALUES (
  'user_' || EXTRACT(EPOCH FROM NOW()) || '_' || substr(md5(random()::text), 1, 9),
  'username',
  'email@example.com',
  '$2a$10$...',  -- Use bcrypt to hash the password
  'user',
  true
);
```

## 🔄 Migration from Old System

The system maintains backwards compatibility:
- Old localStorage-based auth still works
- Users will be prompted to login with the new system
- Warehouse capacity data is preserved

Users should log in with the new system at their earliest convenience.
