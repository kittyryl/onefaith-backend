const db = require("./db");

/**
 * Migration: Standardize all timestamps to TIMESTAMPTZ
 * 
 * This migration:
 * 1. Converts shifts table TIMESTAMP columns to TIMESTAMPTZ
 * 2. Creates missing table definitions for core tables
 * 3. Adds recommended indexes for data integrity
 */

async function runMigration() {
  try {
    console.log("Starting database migration...\n");

    // 1. Alter shifts table to use TIMESTAMPTZ
    console.log("1. Converting shifts table to TIMESTAMPTZ...");
    await db.query(`
      ALTER TABLE shifts 
        ALTER COLUMN start_time TYPE TIMESTAMPTZ USING start_time AT TIME ZONE 'UTC',
        ALTER COLUMN end_time TYPE TIMESTAMPTZ USING end_time AT TIME ZONE 'UTC',
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
    `);
    console.log("   ✓ Shifts table updated");

    // 2. Create products table if not exists
    console.log("\n2. Creating products table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        needs_temp BOOLEAN DEFAULT false,
        image_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("   ✓ Products table created");

    // 3. Create ingredients table if not exists
    console.log("\n3. Creating ingredients table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        unit_of_measure TEXT,
        required_stock NUMERIC(10,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("   ✓ Ingredients table created");

    // 4. Create stock_movements table if not exists
    console.log("\n4. Creating stock_movements table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        quantity NUMERIC(10,2) NOT NULL,
        movement_type VARCHAR(10) NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'AUDIT')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient_id ON stock_movements(ingredient_id);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
    `);
    console.log("   ✓ Stock movements table created");

    // 5. Create orders table if not exists
    console.log("\n5. Creating orders table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        subtotal NUMERIC(12,2) NOT NULL,
        discount NUMERIC(12,2) DEFAULT 0,
        total NUMERIC(12,2) NOT NULL,
        payment_method TEXT,
        cash_tendered NUMERIC(12,2),
        change_due NUMERIC(12,2),
        order_type TEXT,
        discount_type TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
    `);
    console.log("   ✓ Orders table created");

    // 6. Create order_items table if not exists
    console.log("\n6. Creating order_items table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        business_unit TEXT NOT NULL CHECK (business_unit IN ('Coffee', 'Carwash')),
        item_type TEXT NOT NULL,
        unit_price NUMERIC(10,2) NOT NULL,
        quantity INTEGER NOT NULL,
        line_total NUMERIC(12,2) NOT NULL,
        item_details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_business_unit ON order_items(business_unit);
    `);
    console.log("   ✓ Order items table created");

    // 7. Add recommended indexes for data integrity
    console.log("\n7. Adding data integrity indexes...");
    
    // Unique username constraint (if not already exists)
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique 
      ON users(username);
    `);
    console.log("   ✓ Unique username index added");

    // Unique active shift per user (partial index)
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_active_per_user 
      ON shifts(user_id) 
      WHERE status = 'active';
    `);
    console.log("   ✓ Unique active shift per user index added");

    // Additional useful indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);
      CREATE INDEX IF NOT EXISTS idx_carwash_services_status ON carwash_services(status) WHERE status != 'completed';
    `);
    console.log("   ✓ Additional performance indexes added");

    console.log("\n✅ Migration completed successfully!");
    console.log("\nSummary:");
    console.log("- Standardized all timestamps to TIMESTAMPTZ");
    console.log("- Created missing table definitions");
    console.log("- Added data integrity constraints");
    console.log("- Added performance indexes");
    
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    console.error("\nDetails:", err);
    process.exit(1);
  }
}

runMigration();
