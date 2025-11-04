require("dotenv").config();

// Prefer a single DATABASE_URL when available (e.g., Neon pooled URL)
// Falls back to discrete PG_* vars for flexibility
const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
    }
  : {
      user: process.env.PG_USER,
      host: process.env.PG_HOST,
      database: process.env.PG_DATABASE,
      password: process.env.PG_PASSWORD,
      port: Number(process.env.PG_PORT) || 5432,
      max: 20,
      idleTimeoutMillis: 30000,
      ssl: { rejectUnauthorized: false },
    };

module.exports = config;
