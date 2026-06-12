import { Pool } from 'pg'

// Use Neon PostgreSQL connection specifically for Finance Tracker
const databaseUrl = process.env.NEON_DATABASE_URL ||
    `postgresql://${process.env.NEON_POSTGRES_USER}:${process.env.NEON_POSTGRES_PASSWORD}@${process.env.NEON_POSTGRES_HOST}:${process.env.NEON_POSTGRES_PORT}/${process.env.NEON_POSTGRES_DATABASE}?sslmode=require`;

if (!databaseUrl) {
    throw new Error('NEON_DATABASE_URL or Neon credentials are not set');
}

const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
})

// Test the connection
pool.on('connect', () => {
    console.log('Connected to Neon PostgreSQL database (Finance Tracker)')
})

pool.on('error', (err) => {
    console.error('Neon PostgreSQL pool error:', err)
})

export { pool as db }
