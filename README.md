# Synercore Import Schedule

Import Supply Chain Management system for Synercore.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup

**Option A: Using Railway CLI (Recommended)**
```bash
# Login to Railway
railway login

# Link your project
railway link

# Run with Railway environment
railway run npm run dev
```

**Option B: Using .env File**
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your Railway database URL
# Get it from: https://railway.app → Your Project → PostgreSQL → Variables
```

### 3. Initialize Database
```bash
# Run all migrations
npm run setup:db
```

### 4. Run Development Server
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3002
- Backend API: http://localhost:5000

## Available Scripts

- `npm run dev` - Run both client and server in development mode
- `npm run server` - Run only the backend server
- `npm run client` - Run only the frontend
- `npm run build` - Build for production
- `npm run setup:db` - Run all database migrations
- `npm run migrate` - Run main database migration
- `npm run migrate:rejection` - Add rejection workflow fields
- `npm run create-admin` - Create an admin user

## Documentation

- [Database Setup Guide](./DATABASE_SETUP.md) - Detailed database configuration instructions

## Features

- 📦 Shipment tracking and management
- 📅 Week-based scheduling calendar
- 🏭 Warehouse capacity management
- 🔍 Post-arrival workflow (unloading, inspection, receiving)
- ↩️ Shipment rejection/return to supplier
- 📊 Reports and analytics
- 👥 Supplier management
- 💰 Rates and quotes
- 🔒 User authentication and management

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Railway)
- **Hosting**: Railway

## Environment Variables

Required environment variables (see `.env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 5000)
- `VITE_API_BASE_URL` - API base URL for frontend

## Support

For issues or questions, contact the development team.
