// WARNING: This script will DELETE ALL DATA from your main tables.
// Run with: node backend/cleanup_all_data.js

const db = require("./db");

async function cleanup() {
  try {
    // Disable foreign key checks (for PostgreSQL)
    await db.query("SET session_replication_role = replica;");

    // Truncate all main tables (order matters for FKs)
    await db.query(
      "TRUNCATE TABLE order_items, carwash_service_line_items, carwash_service_prices, carwash_services, carwash_services_catalog, stock_movements, ingredients, products, orders, shifts, users RESTART IDENTITY CASCADE;"
    );

    // Re-enable foreign key checks
    await db.query("SET session_replication_role = DEFAULT;");

    console.log("All main tables truncated. Database is now clean.");
    process.exit(0);
  } catch (err) {
    console.error("Error cleaning up database:", err);
    process.exit(1);
  }
}

cleanup();
