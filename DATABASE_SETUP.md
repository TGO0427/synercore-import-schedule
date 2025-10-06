# Database Setup Guide

## For Local Development

### Option 1: Using Railway CLI (Recommended)

1. **Install Railway CLI** (if not already installed):
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Link your project**:
   ```bash
   railway link
   ```

4. **Run with Railway environment**:
   ```bash
   railway run npm run dev
   ```
   This automatically loads all Railway environment variables, including DATABASE_URL.

### Option 2: Using .env File

1. **Copy the example file**:
   ```bash
   cp .env.example .env
   ```

2. **Get your database credentials** from Railway:
   - Go to https://railway.app
   - Open your "Synercore Import Schedule" project
   - Click on the PostgreSQL service
   - Go to Variables tab
   - Copy the `DATABASE_PUBLIC_URL` or `DATABASE_URL`

3. **Update `.env` file** with your actual credentials:
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_HOST.proxy.rlwy.net:YOUR_PORT/railway
   ```

4. **Run the application**:
   ```bash
   npm run dev
   ```

## Initial Database Setup

After connecting to the database for the first time:

1. **Run the main migration**:
   ```bash
   node server/db/migrate.js
   ```
   This creates all tables and loads initial data.

2. **Run the rejection fields migration**:
   ```bash
   node server/db/add-rejection-migration.js
   ```
   This adds the rejection/return workflow fields.

## For Production (Railway)

Railway automatically provides the `DATABASE_URL` environment variable when you add a PostgreSQL service to your project. No additional configuration needed.

## Troubleshooting

### Error: "DATABASE_URL not set"
- Make sure you have a `.env` file in the root directory
- OR use `railway run npm run dev` to load Railway variables

### Error: "Connection refused"
- Check that you're using the PUBLIC database URL (ends with `.railway.app` or `.proxy.rlwy.net`)
- NOT the internal URL (ends with `.railway.internal`)

### Error: "SSL connection error"
- The app is configured to accept Railway's SSL certificates
- If you see warnings, they're normal for Railway connections

## Security Notes

- **Never commit `.env` file** to git (it's already in `.gitignore`)
- **Never share database credentials** publicly
- The `.env.example` file is safe to commit (no real credentials)
