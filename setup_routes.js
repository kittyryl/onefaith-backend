// =============================
// SETUP ROUTES (One-time Setup API)
// Handles creation of tables and setup tasks (manager only, protected)
// =============================

const express = require("express");
const router = express.Router();
const pool = require("./db");
const { authenticateToken, requireManager } = require("./auth_middleware");

// =============================
// ENDPOINT: POST /api/setup/create-shifts-table
// Setup endpoint to create shifts table (manager only, protected by env)
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

      // Create shifts table and indexes
      await pool.query(`
      CREATE TABLE shifts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        end_time TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX idx_shifts_user_id ON shifts(user_id);
      CREATE INDEX idx_shifts_status ON shifts(status);
      CREATE UNIQUE INDEX idx_shifts_active_per_user ON shifts(user_id) WHERE status = 'active';
    `);

      res.json({
        success: true,
        message: "\u2705 Shifts table created successfully!",
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

// Export the router for use in the main server
module.exports = router;
