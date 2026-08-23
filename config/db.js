const { Pool } = require('pg');
const { resolveSsl } = require('./ssl');

// SSL policy lives in config/ssl.js: honors PGSSLSTRICT, PGSSLROOTCERT and
// the sslmode parameter in DATABASE_URL. See that file for the matrix.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(process.env.DATABASE_URL),
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
