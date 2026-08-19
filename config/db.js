const { Pool } = require('pg');

const isRemote =
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('localhost') &&
  !process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

module.exports = pool;
