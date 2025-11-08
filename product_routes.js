const express = require("express");
const router = express.Router();
const db = require("./db");
const { requireManager } = require("./auth_middleware");

// Get products
router.get("/", async (req, res) => {
  try {
    const query = `
            SELECT id, name, category, price, needs_temp, image_url 
            FROM products 
            ORDER BY category, name;
        `;
    const result = await db.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Failed to fetch products." });
  }
});

// Create product
// Create product (manager only)
router.post("/", requireManager, async (req, res) => {
  const { name, category, price, needs_temp, image_url } = req.body;

  if (!name || !category || price === undefined) {
    return res
      .status(400)
      .json({ message: "Missing required product fields." });
  }

  try {
    const query = `
            INSERT INTO products (name, category, price, needs_temp, image_url)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name;
        `;
    const values = [
      name,
      category,
      price,
      needs_temp || false,
      image_url || null,
    ];
    const result = await db.query(query, values);

    res.status(201).json({
      message: "Product created successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ message: "Failed to create product." });
  }
});

// Update product
// Update product (manager only)
router.put("/:id", requireManager, async (req, res) => {
  const id = req.params.id; // Get ID from URL parameter
  const { name, category, price, needs_temp, image_url } = req.body;

  if (!name || !category || price === undefined) {
    return res
      .status(400)
      .json({ message: "Missing required fields for update." });
  }

  try {
    const query = `
            UPDATE products SET 
                name = $1, 
                category = $2, 
                price = $3, 
                needs_temp = $4, 
                image_url = $5
            WHERE id = $6
            RETURNING id, name;
        `;
    const values = [
      name,
      category,
      price,
      needs_temp || false,
      image_url || null,
      id,
    ];
    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.status(200).json({
      message: "Product updated successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Failed to update product." });
  }
});

// Delete product
// Delete product (manager only)
router.delete("/:id", requireManager, async (req, res) => {
  const id = req.params.id;

  try {
    const query = `DELETE FROM products WHERE id = $1 RETURNING id;`;
    const result = await db.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.status(200).json({ message: "Product deleted successfully." });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Failed to delete product." });
  }
});

// Inventory history endpoint
router.get("/history", async (req, res) => {
  try {
    // Optional filters: product_id, date_from, date_to, movement_type
    const { product_id, date_from, date_to, movement_type } = req.query;
    let where = [];
    let params = [];
    let idx = 1;
    if (product_id) {
      where.push(`sm.product_id = $${idx++}`);
      params.push(product_id);
    }
    if (movement_type) {
      where.push(`sm.movement_type = $${idx++}`);
      params.push(movement_type);
    }
    if (date_from) {
      where.push(`sm.created_at >= $${idx++}`);
      params.push(date_from);
    }
    if (date_to) {
      where.push(`sm.created_at <= $${idx++}`);
      params.push(date_to);
    }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT sm.id, sm.product_id, p.name AS product_name, sm.quantity, sm.movement_type, sm.user_id, u.username AS user_name, sm.created_at, sm.note
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.user_id = u.id
      ${whereSQL}
      ORDER BY sm.created_at DESC
      LIMIT 200
    `;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching inventory history:", err);
    res.status(500).json({ message: "Failed to fetch inventory history." });
  }
});

module.exports = router;
