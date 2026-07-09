require('dotenv').config();
const pool = require('./config/db');

async function run() {
  try {
    await pool.query('ALTER TABLE applications ADD COLUMN IF NOT EXISTS tailored_cv_profile JSONB;');
    await pool.query('ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_prep_guide JSONB;');
    console.log('Columns added successfully.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
