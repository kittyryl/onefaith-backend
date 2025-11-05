const db = require("./db");

async function createShiftsTable() {
  try {
    console.log("Creating shifts table...");

    const query = `
      CREATE TABLE IF NOT EXISTS shifts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        end_time TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
      CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_active_per_user ON shifts(user_id) WHERE status = 'active';
    `;

    await db.query(query);
    console.log("✅ Shifts table created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating shifts table:", error.message);
    process.exit(1);
  }
}

createShiftsTable();
