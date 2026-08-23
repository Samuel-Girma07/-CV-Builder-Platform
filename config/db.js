const { Pool } = require('pg');

const isRemote =
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('localhost') &&
  !process.env.DATABASE_URL.includes('127.0.0.1');

// Certificate validation is ON by default; PGSSLSTRICT=false opts out ONLY
// for databases that legitimately use self-signed certificates.
const sslStrict = process.env.PGSSLSTRICT !== 'false';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: sslStrict } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

/*
  Run a unit of work atomically. Attaching to the pool keeps every existing
  `require('../config/db')` call site working unchanged.
*/
pool.withTransaction = async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = pool;
