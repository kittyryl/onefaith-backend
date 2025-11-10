const express = require("express");
const router = express.Router();
const db = require("./db");
const logger = require("./logger");
const { requireManager } = require("./auth_middleware");

// Get ingredients with calculated current stock
router.get("/", async (req, res) => {
  try {
    // Support ?archived=true|false (default: false)
    let archived = false;
    if (typeof req.query.archived === "string") {
      archived = req.query.archived === "true";
    }
    const query = `
      WITH latest_audit AS (
        SELECT DISTINCT ON (ingredient_id)
          ingredient_id,
          quantity AS audit_quantity,
          created_at AS audit_time
        FROM stock_movements
        WHERE movement_type = 'AUDIT'
        ORDER BY ingredient_id, created_at DESC
      ),
      movements_after_audit AS (
        SELECT 
          sm.ingredient_id,
          SUM(
            CASE 
              WHEN sm.movement_type = 'IN' THEN sm.quantity 
              WHEN sm.movement_type = 'OUT' THEN -sm.quantity
              ELSE 0 
            END
          ) AS net_movement
        FROM stock_movements sm
        LEFT JOIN latest_audit la ON sm.ingredient_id = la.ingredient_id
        WHERE sm.movement_type IN ('IN', 'OUT')
          AND (la.audit_time IS NULL OR sm.created_at > la.audit_time)
        GROUP BY sm.ingredient_id
      )
      SELECT 
        i.id, i.name, i.category, i.unit_of_measure, i.required_stock, i.archived,
        COALESCE(la.audit_quantity, 0) + COALESCE(maa.net_movement, 0) AS current_stock
      FROM ingredients i
      LEFT JOIN latest_audit la ON i.id = la.ingredient_id
      LEFT JOIN movements_after_audit maa ON i.id = maa.ingredient_id
      WHERE i.archived = $1
      ORDER BY i.category, i.name;
    `;
    const result = await db.query(query, [archived]);
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error("Error calculating current stock", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Failed to calculate current stock." });
  }
});

// Create ingredient
// Create ingredient (manager only)
router.post("/", requireManager, async (req, res) => {
  const { name, category, unit_of_measure, required_stock } = req.body;

  // Validation
  if (!name || !category) {
    logger.warn("Ingredient creation failed: Missing name or category");
    return res.status(400).json({ message: "Name and category are required" });
  }

  const trimmedName = String(name).trim();
  if (trimmedName.length > 100) {
    logger.warn("Ingredient creation failed: Name too long", {
      name: trimmedName,
    });
    return res
      .status(400)
      .json({ message: "Ingredient name must be 100 characters or less" });
  }

  if (
    required_stock !== undefined &&
    (isNaN(required_stock) || required_stock < 0)
  ) {
    logger.warn("Ingredient creation failed: Invalid required stock", {
      required_stock,
    });
    return res
      .status(400)
      .json({ message: "Required stock must be a positive number" });
  }

  try {
    // Prevent duplicate ingredient names (case-insensitive)
    const dupCheck = await db.query(
      "SELECT id FROM ingredients WHERE LOWER(name) = LOWER($1)",
      [trimmedName]
    );
    if (dupCheck.rowCount > 0) {
      logger.warn("Ingredient creation failed: Duplicate name", {
        name: trimmedName,
      });
      return res.status(409).json({
        message:
          "An ingredient with this name already exists. Please use a different name.",
      });
    }

    const query = `
            INSERT INTO ingredients (name, category, unit_of_measure, required_stock)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name;
        `;
    const values = [
      trimmedName,
      String(category).trim(),
      unit_of_measure || null,
      required_stock || 0,
    ];
    const result = await db.query(query, values);
    logger.info("Ingredient created successfully", {
      ingredient: result.rows[0],
    });
    res.status(201).json({
      message: "Ingredient created successfully",
      ingredient: result.rows[0],
    });
  } catch (error) {
    logger.error("Error creating ingredient", {
      error: error.message,
      stack: error.stack,
    });
    res
      .status(500)
      .json({ message: "Unable to create the ingredient at this time." });
  }
});

// Record stock movement (IN/OUT/AUDIT)
// Record stock movement (AUDIT restricted to manager)
router.post("/movement", async (req, res) => {
  const { ingredient_id, quantity, movement_type, notes } = req.body;

  // Validation
  if (!ingredient_id || quantity === undefined || !movement_type) {
    logger.warn("Stock movement failed: Missing required fields");
    return res.status(400).json({
      message: "Ingredient ID, quantity, and movement type are required",
    });
  }

  if (!["IN", "OUT", "AUDIT"].includes(movement_type)) {
    logger.warn("Stock movement failed: Invalid movement type", {
      movement_type,
    });
    return res
      .status(400)
      .json({ message: "Movement type must be IN, OUT, or AUDIT" });
  }

  // Allow both staff and manager to perform AUDIT

  // Validate quantity based on movement type and prevent negative stock
  // Get current stock for this ingredient
  let currentStock = 0;
  try {
    const stockResult = await db.query(
      `WITH latest_audit AS (
        SELECT DISTINCT ON (ingredient_id)
          ingredient_id,
          quantity AS audit_quantity,
          created_at AS audit_time
        FROM stock_movements
        WHERE movement_type = 'AUDIT' AND ingredient_id = $1
        ORDER BY ingredient_id, created_at DESC
      ),
      movements_after_audit AS (
        SELECT 
          sm.ingredient_id,
          SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity WHEN sm.movement_type = 'OUT' THEN -sm.quantity ELSE 0 END) AS net_movement
        FROM stock_movements sm
        LEFT JOIN latest_audit la ON sm.ingredient_id = la.ingredient_id
        WHERE sm.ingredient_id = $1 AND sm.movement_type IN ('IN', 'OUT')
          AND (la.audit_time IS NULL OR sm.created_at > la.audit_time)
        GROUP BY sm.ingredient_id
      )
      SELECT COALESCE(la.audit_quantity, 0) + COALESCE(maa.net_movement, 0) AS current_stock
      FROM ingredients i
      LEFT JOIN latest_audit la ON i.id = la.ingredient_id
      LEFT JOIN movements_after_audit maa ON i.id = maa.ingredient_id
      WHERE i.id = $1`,
      [ingredient_id]
    );
    if (stockResult.rows.length > 0) {
      currentStock = Number(stockResult.rows[0].current_stock) || 0;
    }
  } catch (err) {
    logger.error("Error checking current stock before movement", {
      error: err.message,
    });
    return res.status(500).json({ message: "Failed to check current stock." });
  }

  if (movement_type === "AUDIT") {
    if (isNaN(quantity) || quantity < 0) {
      logger.warn("Stock movement failed: Invalid AUDIT quantity", {
        quantity,
      });
      return res
        .status(400)
        .json({ message: "AUDIT quantity must be zero or positive" });
    }
    // Prevent setting stock negative via AUDIT
    if (quantity < 0) {
      logger.warn("Stock movement failed: AUDIT would set negative stock", {
        quantity,
      });
      return res.status(400).json({ message: "Cannot set stock below zero" });
    }
  } else if (movement_type === "OUT") {
    if (isNaN(quantity) || quantity <= 0) {
      logger.warn("Stock movement failed: Invalid quantity for OUT", {
        movement_type,
        quantity,
      });
      return res
        .status(400)
        .json({ message: "Quantity for OUT must be greater than zero" });
    }
    if (currentStock - quantity < 0) {
      logger.error("Stock movement BLOCKED: OUT would make stock negative", {
        ingredient_id,
        currentStock,
        quantity,
        user: req.user,
      });
      return res.status(400).json({
        message:
          "Not enough stock. This operation would make stock negative. Current stock: " +
          currentStock +
          ", attempted OUT: " +
          quantity,
      });
    }
  } else if (movement_type === "IN") {
    if (isNaN(quantity) || quantity <= 0) {
      logger.warn("Stock movement failed: Invalid quantity for IN", {
        movement_type,
        quantity,
      });
      return res
        .status(400)
        .json({ message: "Quantity for IN must be greater than zero" });
    }
  }

  // Validate notes length
  if (notes && notes.length > 500) {
    logger.warn("Stock movement failed: Notes too long");
    return res
      .status(400)
      .json({ message: "Notes must be 500 characters or less" });
  }

  try {
    // Ensure user_id column exists (idempotent)
    await db.query(
      "ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS user_id INT NULL"
    );

    const query = `
            INSERT INTO stock_movements (ingredient_id, user_id, quantity, movement_type, notes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id;
        `;
    const userId = (req.user && (req.user.userId || req.user.id)) || null;
    const values = [
      ingredient_id,
      userId,
      quantity,
      movement_type,
      notes || null,
    ];
    const result = await db.query(query, values);
    logger.info("Stock movement recorded", {
      movementId: result.rows[0].id,
      ingredient_id,
      movement_type,
      quantity,
      userId,
    });
    res.status(201).json({
      message: "Stock movement recorded successfully",
      movementId: result.rows[0].id,
    });
  } catch (error) {
    logger.error("Error recording stock movement", {
      error: error.message,
      stack: error.stack,
    });
    res
      .status(500)
      .json({ message: "Failed to record stock movement. Please try again." });
  }
});

// Update ingredient
// Update ingredient (manager only)
router.put("/:id", requireManager, async (req, res) => {
  const id = req.params.id;
  const { name, category, unit_of_measure, required_stock } = req.body;

  // Validation
  if (!name || !category || required_stock === undefined) {
    logger.warn("Ingredient update failed: Missing required fields", { id });
    return res
      .status(400)
      .json({ message: "Name, category, and required stock are required" });
  }

  const trimmedName = String(name).trim();
  if (trimmedName.length > 100) {
    logger.warn("Ingredient update failed: Name too long", {
      id,
      name: trimmedName,
    });
    return res
      .status(400)
      .json({ message: "Ingredient name must be 100 characters or less" });
  }

  if (isNaN(required_stock) || required_stock < 0) {
    logger.warn("Ingredient update failed: Invalid required stock", {
      id,
      required_stock,
    });
    return res
      .status(400)
      .json({ message: "Required stock must be a positive number" });
  }

  try {
    // Prevent renaming to an existing ingredient name (case-insensitive)
    const dupCheck = await db.query(
      "SELECT id FROM ingredients WHERE LOWER(name) = LOWER($1) AND id <> $2",
      [trimmedName, id]
    );
    if (dupCheck.rowCount > 0) {
      logger.warn("Ingredient update failed: Duplicate name", {
        id,
        name: trimmedName,
      });
      return res.status(409).json({
        message:
          "An ingredient with this name already exists. Please use a different name.",
      });
    }

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
      trimmedName,
      String(category).trim(),
      unit_of_measure || null,
      required_stock,
      id,
    ];
    const result = await db.query(query, values);
    if (result.rowCount === 0) {
      logger.warn("Ingredient update failed: Not found", { id });
      return res.status(404).json({ message: "Ingredient not found." });
    }
    logger.info("Ingredient updated successfully", {
      ingredient: result.rows[0],
    });
    res.status(200).json({
      message: "Ingredient updated successfully",
      ingredient: result.rows[0],
    });
  } catch (error) {
    logger.error("Error updating ingredient", {
      error: error.message,
      stack: error.stack,
      id,
    });
    res
      .status(500)
      .json({ message: "Unable to update the ingredient at this time." });
  }
});

// Delete ingredient
// Delete ingredient (manager only)
router.delete("/:id", requireManager, async (req, res) => {
  const id = req.params.id;

  try {
    const query = `DELETE FROM ingredients WHERE id = $1 RETURNING id;`;
    const result = await db.query(query, [id]);
    if (result.rowCount === 0) {
      logger.warn("Ingredient deletion failed: Not found", { id });
      return res.status(404).json({ message: "Ingredient not found." });
    }
    logger.info("Ingredient deleted successfully", { id });
    res.status(200).json({ message: "Ingredient deleted successfully" });
  } catch (error) {
    logger.error("Error deleting ingredient", {
      error: error.message,
      stack: error.stack,
      id,
    });
    res
      .status(500)
      .json({ message: "Unable to delete the ingredient at this time." });
  }
});

module.exports = router;

// Archive ingredient (manager only)
router.post("/:id/archive", requireManager, async (req, res) => {
  const id = req.params.id;
  try {
    const query = `UPDATE ingredients SET archived = true WHERE id = $1 RETURNING *;`;
    const result = await db.query(query, [id]);
    if (result.rowCount === 0) {
      logger.warn("Ingredient archive failed: Not found", { id });
      return res.status(404).json({ message: "Ingredient not found." });
    }
    logger.info("Ingredient archived successfully", { id });
    res.status(200).json({ message: "Ingredient archived successfully", ingredient: result.rows[0] });
  } catch (error) {
    logger.error("Error archiving ingredient", { error: error.message, stack: error.stack, id });
    res.status(500).json({ message: "Unable to archive the ingredient at this time." });
  }
});

// Unarchive ingredient (manager only)
router.post("/:id/unarchive", requireManager, async (req, res) => {
  const id = req.params.id;
  try {
    const query = `UPDATE ingredients SET archived = false WHERE id = $1 RETURNING *;`;
    const result = await db.query(query, [id]);
    if (result.rowCount === 0) {
      logger.warn("Ingredient unarchive failed: Not found", { id });
      return res.status(404).json({ message: "Ingredient not found." });
    }
    logger.info("Ingredient unarchived successfully", { id });
    res.status(200).json({ message: "Ingredient unarchived successfully", ingredient: result.rows[0] });
  } catch (error) {
    logger.error("Error unarchiving ingredient", { error: error.message, stack: error.stack, id });
    res.status(500).json({ message: "Unable to unarchive the ingredient at this time." });
  }
});
