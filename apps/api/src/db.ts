import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '../../.env' });

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

export const pool = new Pool({ connectionString });

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});
