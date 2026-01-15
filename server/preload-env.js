// Preload environment variables before any other imports
import dotenv from 'dotenv';

// Load .env file
if (!process.env.DATABASE_URL) {
  dotenv.config();
}
