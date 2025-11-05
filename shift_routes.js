const express = require("express");
const router = express.Router();
const db = require("./db");
const { authenticateToken } = require("./auth_middleware");

// Get current active shift for logged-in user
router.get("/current", authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT s.*, u.username, u.full_name 
      FROM shifts s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = $1 AND s.status = 'active'
      ORDER BY s.start_time DESC
      LIMIT 1
    `;
    const result = await db.query(query, [req.user.userId]);

    if (result.rowCount === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching current shift:", error);
    res.status(500).json({ message: "Failed to fetch current shift" });
  }
});

// Start a new shift
router.post("/start", authenticateToken, async (req, res) => {
  try {
    // Check if user already has an active shift
    const checkQuery = `
      SELECT id FROM shifts 
      WHERE user_id = $1 AND status = 'active'
    `;
    const existingShift = await db.query(checkQuery, [req.user.userId]);

    if (existingShift.rowCount > 0) {
      return res
        .status(400)
        .json({ message: "You already have an active shift" });
    }

    // Create new shift
    const insertQuery = `
      INSERT INTO shifts (user_id, start_time, status)
      VALUES ($1, NOW(), 'active')
      RETURNING *
    `;
    const result = await db.query(insertQuery, [req.user.userId]);

    res.status(201).json({
      message: "Shift started successfully",
      shift: result.rows[0],
    });
  } catch (error) {
    console.error("Error starting shift:", error);
    res.status(500).json({ message: "Failed to start shift" });
  }
});

// End current shift
router.post("/end", authenticateToken, async (req, res) => {
  const { notes } = req.body;

  try {
    const query = `
      UPDATE shifts
      SET end_time = NOW(), status = 'ended', notes = $1
      WHERE user_id = $2 AND status = 'active'
      RETURNING *
    `;
    const result = await db.query(query, [notes || null, req.user.userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "No active shift found" });
    }

    res.json({
      message: "Shift ended successfully",
      shift: result.rows[0],
    });
  } catch (error) {
    console.error("Error ending shift:", error);
    res.status(500).json({ message: "Failed to end shift" });
  }
});

// Get shift history (for current user or all if manager)
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const isManager = req.user.role === "manager";
    const userId = isManager ? req.query.userId : req.user.userId;

    let query = `
      SELECT s.*, u.username, u.full_name 
      FROM shifts s
      JOIN users u ON s.user_id = u.id
    `;
    const params = [];

    if (userId) {
      query += ` WHERE s.user_id = $1`;
      params.push(userId);
    }

    query += ` ORDER BY s.start_time DESC LIMIT 50`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching shift history:", error);
    res.status(500).json({ message: "Failed to fetch shift history" });
  }
});

module.exports = router;
