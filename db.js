// pos-backend/db.js

const { Pool } = require('pg');
const config = require('./db_config');

// Create a new Pool instance
const pool = new Pool(config);

// Only log an error if a client fails
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Export the pool directly, and wrap the query function for convenience
module.exports = {
  pool: pool,
  query: (text, params) => pool.query(text, params),
};