const express = require("express");
const router = express.Router();
const pool = require("./db");
const { authenticateToken, requireManager } = require("./auth_middleware");

// Setup endpoint to create shifts table
// Extra guard: refuse if not explicitly enabled via env
router.post(
  "/create-shifts-table",
  authenticateToken,
  requireManager,
  async (req, res) => {
    if (process.env.ENABLE_SETUP !== "true") {
      return res.status(403).json({
        success: false,
        error: "Setup endpoints are disabled",
      });
    }
  try {
    // Check if table already exists
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'shifts'
      );
    `);

    if (checkTable.rows[0].exists) {
      return res.json({
        success: true,
        message: "Shifts table already exists",
      });
    }

    // Create shifts table
    await pool.query(`
      CREATE TABLE shifts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        start_time TIMESTAMP NOT NULL DEFAULT NOW(),
        end_time TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_shifts_user_id ON shifts(user_id);
      CREATE INDEX idx_shifts_status ON shifts(status);
    `);

    res.json({
      success: true,
      message: "✅ Shifts table created successfully!",
    });
  } catch (error) {
    console.error("Error creating shifts table:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
  }
);

module.exports = router;
