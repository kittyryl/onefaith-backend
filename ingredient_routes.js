// pos-backend/ingredient_routes.js

const express = require("express");
const router = express.Router();
const db = require("./db");

// --- GET: Fetch all ingredients WITH CALCULATED CURRENT STOCK ---
router.get("/", async (req, res) => {
  try {
    const query = `
            SELECT 
                i.id, i.name, i.category, i.unit_of_measure, i.required_stock,
                COALESCE(SUM(
                    CASE 
                        WHEN sm.movement_type = 'IN' OR sm.movement_type = 'AUDIT' THEN sm.quantity 
                        WHEN sm.movement_type = 'OUT' THEN -sm.quantity
                        ELSE 0 
                    END
                ), 0) AS current_stock
            FROM ingredients i
            LEFT JOIN stock_movements sm ON i.id = sm.ingredient_id
            GROUP BY i.id, i.name, i.category, i.unit_of_measure, i.required_stock
            ORDER BY i.category, i.name;
        `;
    const result = await db.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error calculating current stock:", error);
    res.status(500).json({ message: "Failed to calculate current stock." });
  }
});

// --- POST: Add a new ingredient ---
router.post("/", async (req, res) => {
  const { name, category, unit_of_measure, required_stock } = req.body;

  if (!name || !category) {
    return res
      .status(400)
      .json({ message: "Missing required fields: name or category." });
  }

  try {
    const query = `
            INSERT INTO ingredients (name, category, unit_of_measure, required_stock)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name;
        `;
    const values = [
      name,
      category,
      unit_of_measure || null,
      required_stock || 0,
    ];
    const result = await db.query(query, values);
    res.status(201).json({
      message: "Ingredient created successfully",
      ingredient: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating ingredient:", error);
    res.status(500).json({ message: "Failed to create ingredient." });
  }
});

// --- POST: Record a new stock movement (IN/OUT/AUDIT) ---
router.post("/movement", async (req, res) => {
  const { ingredient_id, quantity, movement_type, notes } = req.body;

  if (!ingredient_id || !quantity || !movement_type) {
    return res
      .status(400)
      .json({ message: "Missing required fields for movement." });
  }
  if (!["IN", "OUT", "AUDIT"].includes(movement_type)) {
    return res.status(400).json({ message: "Invalid movement type." });
  }

  try {
    const query = `
            INSERT INTO stock_movements (ingredient_id, quantity, movement_type, notes)
            VALUES ($1, $2, $3, $4)
            RETURNING id;
        `;
    const values = [ingredient_id, quantity, movement_type, notes || null];
    const result = await db.query(query, values);
    res.status(201).json({
      message: "Stock movement recorded successfully",
      movementId: result.rows[0].id,
    });
  } catch (error) {
    console.error("Error recording stock movement:", error);
    res.status(500).json({ message: "Failed to record stock movement." });
  }
});

// --- PUT: Update an existing ingredient by ID ---
router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const { name, category, unit_of_measure, required_stock } = req.body;

  if (!name || !category || required_stock === undefined) {
    return res
      .status(400)
      .json({ message: "Missing required fields for update." });
  }

  try {
    const query = `
            UPDATE ingredients SET 
                name = $1, 
                category = $2, 
                unit_of_measure = $3, 
                required_stock = $4
            WHERE id = $5
            RETURNING id, name;
        `;
    const values = [
      name,
      category,
      unit_of_measure || null,
      required_stock,
      id,
    ];
    const result = await db.query(query, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Ingredient not found." });
    }
    res.status(200).json({
      message: "Ingredient updated successfully",
      ingredient: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating ingredient:", error);
    res.status(500).json({ message: "Failed to update ingredient." });
  }
});

// --- DELETE: Remove an ingredient by ID (FIXED) ---
router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await db.query("BEGIN"); // Start transaction
    await db.query("DELETE FROM stock_movements WHERE ingredient_id = $1", [
      id,
    ]);
    const result = await db.query(
      "DELETE FROM ingredients WHERE id = $1 RETURNING id",
      [id]
    );
    await db.query("COMMIT"); // Success!

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Ingredient not found." });
    }
    res.status(200).json({
      message: "Ingredient and all related movements deleted successfully.",
    });
  } catch (error) {
    await db.query("ROLLBACK"); // Undo if anything failed
    console.error("Error deleting ingredient:", error);
    res.status(500).json({ message: "Failed to delete ingredient." });
  }
});

module.exports = router;
