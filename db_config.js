// pos-backend/db_config.js

require('dotenv').config();

const config = {
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  max: 20, 
  idleTimeoutMillis: 30000,
  
  // --- ADD THIS LINE ---
  ssl: {
    // This setting is necessary for cloud providers like Neon
    rejectUnauthorized: false 
  },
  // --- END ADDITION ---
};

module.exports = config;