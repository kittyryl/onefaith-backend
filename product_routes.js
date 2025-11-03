// pos-backend/product_routes.js

const express = require("express");
const router = express.Router();
const db = require("./db");

// --- 1. GET: Fetch all products (for POS & Inventory list) ---
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

// --- 2. POST: Add a new product (from Inventory page) ---
router.post("/", async (req, res) => {
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

// --- 3. PUT: Update an existing product by ID (FIX for 404 Error) ---
router.put("/:id", async (req, res) => {
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

// --- 4. DELETE: Remove a product by ID (FIX for 404 Error) ---
router.delete("/:id", async (req, res) => {
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

module.exports = router;
