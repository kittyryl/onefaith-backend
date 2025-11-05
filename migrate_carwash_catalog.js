/**
 * migrate_carwash_catalog.js
 * 
 * Creates carwash service catalog tables and seeds with existing data.
 * This replaces the hardcoded services in the frontend with database-driven catalog.
 * 
 * Tables:
 * - carwash_services_catalog: Service definitions (name, category, description)
 * - carwash_service_prices: Vehicle type and price combinations for each service
 * 
 * Run: node migrate_carwash_catalog.js
 */

const { pool } = require("./db");

async function migrateCarwashCatalog() {
  const client = await pool.connect();

  try {
    console.log("🚗 Starting carwash catalog migration...\n");

    // Create carwash_services_catalog table
    console.log("Creating carwash_services_catalog table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS carwash_services_catalog (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        display_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("✅ carwash_services_catalog table created\n");

    // Create carwash_service_prices table
    console.log("Creating carwash_service_prices table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS carwash_service_prices (
        id SERIAL PRIMARY KEY,
        service_id INT NOT NULL REFERENCES carwash_services_catalog(id) ON DELETE CASCADE,
        vehicle_type VARCHAR(50) NOT NULL,
        price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (service_id, vehicle_type)
      );
    `);
    console.log("✅ carwash_service_prices table created\n");

    // Create indexes for performance
    console.log("Creating indexes...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_carwash_catalog_active 
      ON carwash_services_catalog(is_active);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_carwash_prices_service 
      ON carwash_service_prices(service_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_carwash_prices_active 
      ON carwash_service_prices(is_active);
    `);
    console.log("✅ Indexes created\n");

    // Check if data already exists
    const { rows: existingServices } = await client.query(
      "SELECT COUNT(*) as count FROM carwash_services_catalog"
    );

    if (existingServices[0].count > 0) {
      console.log("⚠️  Data already exists. Skipping seed.\n");
      console.log("✅ Migration completed successfully!");
      return;
    }

    // Seed with existing services data
    console.log("Seeding services catalog...");

    const services = [
      {
        name: "Detailed Wash",
        category: "Basic",
        description: "Exterior wash/dry, tire/wheel cleaning, interior cleaning, vacuum, armor all.",
        display_order: 1,
        prices: [
          { vehicle: "Bike", price: 100 },
          { vehicle: "Big Bike", price: 150 },
          { vehicle: "Sedan", price: 200 },
          { vehicle: "CSUV", price: 250 },
          { vehicle: "SUV", price: 300 },
          { vehicle: "Van Pickup", price: 350 },
          { vehicle: "FB Van Grandia", price: 400 },
        ],
      },
      {
        name: "Detailed Wash & Wax",
        category: "Most Popular",
        description: "All Detailed Wash features + professional hand waxing.",
        display_order: 2,
        prices: [
          { vehicle: "Bike", price: 250 },
          { vehicle: "Big Bike", price: 300 },
          { vehicle: "Sedan", price: 500 },
          { vehicle: "CSUV", price: 600 },
          { vehicle: "SUV", price: 700 },
          { vehicle: "Van Pickup", price: 900 },
          { vehicle: "Truck", price: 950 },
        ],
      },
      {
        name: "Ceramic Coating",
        category: "Advanced",
        description: "Ultimate luxury treatment, paint sealant, glass cleaning, deluxe detailing.",
        display_order: 3,
        prices: [
          { vehicle: "Bikes", price: 3000 },
          { vehicle: "Small", price: 12000 },
          { vehicle: "Medium", price: 15000 },
          { vehicle: "Large", price: 18000 },
          { vehicle: "XLarge", price: 21000 },
          { vehicle: "XXLarge", price: 24000 },
        ],
      },
      {
        name: "Bac-2-Zero",
        category: "Others",
        description: "Interior sanitation service.",
        display_order: 4,
        prices: [
          { vehicle: "S", price: 500 },
          { vehicle: "M", price: 550 },
          { vehicle: "L", price: 600 },
          { vehicle: "XL", price: 650 },
          { vehicle: "XXL", price: 700 },
        ],
      },
      {
        name: "Buffing Wax",
        category: "Others",
        description: "Machine buffing for paint correction.",
        display_order: 5,
        prices: [
          { vehicle: "S", price: 600 },
          { vehicle: "M", price: 700 },
          { vehicle: "L", price: 800 },
          { vehicle: "XL", price: 900 },
          { vehicle: "XXL", price: 1000 },
        ],
      },
      {
        name: "Glass Cleaning",
        category: "Others",
        description: "Full exterior/interior glass detailing.",
        display_order: 6,
        prices: [
          { vehicle: "S", price: 1250 },
          { vehicle: "M", price: 1400 },
          { vehicle: "L", price: 1700 },
          { vehicle: "XL", price: 1800 },
          { vehicle: "XXL", price: 1950 },
        ],
      },
      {
        name: "Hand Wax",
        category: "Others",
        description: "Protective hand waxing service.",
        display_order: 7,
        prices: [
          { vehicle: "S", price: 400 },
          { vehicle: "M", price: 500 },
          { vehicle: "L", price: 600 },
          { vehicle: "XL", price: 700 },
          { vehicle: "XXL", price: 800 },
        ],
      },
    ];

    for (const service of services) {
      // Insert service
      const { rows } = await client.query(
        `INSERT INTO carwash_services_catalog 
        (name, category, description, display_order) 
        VALUES ($1, $2, $3, $4) 
        RETURNING id`,
        [service.name, service.category, service.description, service.display_order]
      );

      const serviceId = rows[0].id;

      // Insert prices
      for (const price of service.prices) {
        await client.query(
          `INSERT INTO carwash_service_prices 
          (service_id, vehicle_type, price) 
          VALUES ($1, $2, $3)`,
          [serviceId, price.vehicle, price.price]
        );
      }

      console.log(`✅ Seeded: ${service.name} with ${service.prices.length} prices`);
    }

    console.log("\n✅ Migration completed successfully!");
    console.log(`\nSummary:`);
    console.log(`- Created 2 tables: carwash_services_catalog, carwash_service_prices`);
    console.log(`- Created 3 indexes for performance`);
    console.log(`- Seeded ${services.length} services with pricing data`);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrateCarwashCatalog();
