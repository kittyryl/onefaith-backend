const db = require("./db");
const bcrypt = require("bcryptjs");

async function createUsersTable() {
  try {
    console.log("Creating users table...\n");

    // Create users table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('manager', 'staff')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await db.query(createTableSQL);
    console.log("✓ Users table created successfully");

    // Create default admin account
    const adminPassword = await bcrypt.hash("admin123", 10);
    const staffPassword = await bcrypt.hash("staff123", 10);

    const insertSQL = `
      INSERT INTO users (username, password_hash, full_name, role)
      VALUES 
        ('admin', $1, 'Administrator', 'manager'),
        ('staff', $2, 'Staff User', 'staff')
      ON CONFLICT (username) DO NOTHING
      RETURNING username, role;
    `;

    const result = await db.query(insertSQL, [adminPassword, staffPassword]);

    if (result.rowCount > 0) {
      console.log("\n✓ Default users created:");
      result.rows.forEach((user) => {
        console.log(`  - ${user.username} (${user.role})`);
      });
      console.log("\nDefault credentials:");
      console.log("  Manager: admin / admin123");
      console.log("  Staff: staff / staff123");
    } else {
      console.log("\n✓ Users table exists with default accounts");
    }

    console.log("\n✅ Setup complete!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

createUsersTable();
