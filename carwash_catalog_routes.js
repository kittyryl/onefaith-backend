/**
 * carwash_catalog_routes.js
 *
 * API routes for managing carwash services catalog.
 * Public endpoints for POS to fetch services.
 * Protected endpoints for managers to CRUD services and prices.
 */

const express = require("express");
const { pool } = require("./db");
const { authenticateToken, requireManager } = require("./auth_middleware");

const router = express.Router();

// ===== PUBLIC ENDPOINTS (for POS) =====

/**
 * GET /api/carwash-catalog/services
 * Get all active services with their prices
 * Public endpoint for POS interface
 */
router.get("/services", async (req, res) => {
  try {
    const servicesQuery = `
      SELECT 
        id, name, category, description, display_order
      FROM carwash_services_catalog
      WHERE is_active = TRUE
      ORDER BY display_order ASC, name ASC
    `;
    const { rows: services } = await pool.query(servicesQuery);

    // Fetch prices for each service
    for (const service of services) {
      const pricesQuery = `
        SELECT vehicle_type, (price::double precision) AS price
        FROM carwash_service_prices
        WHERE service_id = $1 AND is_active = TRUE
        ORDER BY price ASC
      `;
      const { rows: prices } = await pool.query(pricesQuery, [service.id]);
      service.prices = prices;
    }

    res.json(services);
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

/**
 * GET /api/carwash-catalog/services/:id
 * Get single service with prices
 * Public endpoint
 */
router.get("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const serviceQuery = `
      SELECT id, name, category, description, display_order, is_active
      FROM carwash_services_catalog
      WHERE id = $1
    `;
    const { rows: serviceRows } = await pool.query(serviceQuery, [id]);

    if (serviceRows.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }

    const service = serviceRows[0];

    // Fetch prices
    const pricesQuery = `
      SELECT id, vehicle_type, (price::double precision) AS price, is_active
      FROM carwash_service_prices
      WHERE service_id = $1
      ORDER BY price ASC
    `;
    const { rows: prices } = await pool.query(pricesQuery, [id]);
    service.prices = prices;

    res.json(service);
  } catch (error) {
    console.error("Error fetching service:", error);
    res.status(500).json({ error: "Failed to fetch service" });
  }
});

// ===== PROTECTED ENDPOINTS (Manager only) =====

/**
 * GET /api/carwash-catalog/admin/services
 * Get all services (including inactive) for management
 * Manager only
 */
router.get(
  "/admin/services",
  authenticateToken,
  requireManager,
  async (req, res) => {
    try {
      const servicesQuery = `
      SELECT 
        id, name, category, description, display_order, is_active,
        created_at, updated_at
      FROM carwash_services_catalog
      ORDER BY display_order ASC, name ASC
    `;
      const { rows: services } = await pool.query(servicesQuery);

      // Fetch prices for each service
      for (const service of services) {
        const pricesQuery = `
        SELECT id, vehicle_type, (price::double precision) AS price, is_active, created_at
        FROM carwash_service_prices
        WHERE service_id = $1
        ORDER BY price ASC
      `;
        const { rows: prices } = await pool.query(pricesQuery, [service.id]);
        service.prices = prices;
      }

      res.json(services);
    } catch (error) {
      console.error("Error fetching admin services:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  }
);

/**
 * POST /api/carwash-catalog/admin/services
 * Create new service
 * Manager only
 */
router.post(
  "/admin/services",
  authenticateToken,
  requireManager,
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { name, category, description, display_order = 0 } = req.body;

      if (!name || !category) {
        return res
          .status(400)
          .json({ error: "Name and category are required" });
      }

      await client.query("BEGIN");

      const insertQuery = `
      INSERT INTO carwash_services_catalog 
      (name, category, description, display_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
      const { rows } = await client.query(insertQuery, [
        name,
        category,
        description || null,
        display_order,
      ]);

      await client.query("COMMIT");

      res.status(201).json(rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error creating service:", error);
      res.status(500).json({ error: "Failed to create service" });
    } finally {
      client.release();
    }
  }
);

/**
 * PUT /api/carwash-catalog/admin/services/:id
 * Update service
 * Manager only
 */
router.put(
  "/admin/services/:id",
  authenticateToken,
  requireManager,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, category, description, display_order, is_active } =
        req.body;

      const updateQuery = `
      UPDATE carwash_services_catalog
      SET 
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        description = COALESCE($3, description),
        display_order = COALESCE($4, display_order),
        is_active = COALESCE($5, is_active),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;

      const { rows } = await pool.query(updateQuery, [
        name,
        category,
        description,
        display_order,
        is_active,
        id,
      ]);

      if (rows.length === 0) {
        return res.status(404).json({ error: "Service not found" });
      }

      res.json(rows[0]);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ error: "Failed to update service" });
    }
  }
);

/**
 * DELETE /api/carwash-catalog/admin/services/:id
 * Delete service (cascades to prices)
 * Manager only
 */
router.delete(
  "/admin/services/:id",
  authenticateToken,
  requireManager,
  async (req, res) => {
    try {
      const { id } = req.params;

      const deleteQuery =
        "DELETE FROM carwash_services_catalog WHERE id = $1 RETURNING *";
      const { rows } = await pool.query(deleteQuery, [id]);

      if (rows.length === 0) {
        return res.status(404).json({ error: "Service not found" });
      }

      res.json({ message: "Service deleted successfully", service: rows[0] });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  }
);

/**
 * POST /api/carwash-catalog/admin/prices
 * Add price to service
 * Manager only
 */
router.post(
  "/admin/prices",
  authenticateToken,
  requireManager,
  async (req, res) => {
    try {
      const { service_id, vehicle_type, price } = req.body;

      if (!service_id || !vehicle_type || price === undefined) {
        return res
          .status(400)
          .json({ error: "service_id, vehicle_type, and price are required" });
      }

      const insertQuery = `
      INSERT INTO carwash_service_prices 
      (service_id, vehicle_type, price)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

      const { rows } = await pool.query(insertQuery, [
        service_id,
        vehicle_type,
        price,
      ]);

      res.status(201).json(rows[0]);
    } catch (error) {
      console.error("Error adding price:", error);
      if (error.code === "23505") {
        // Unique constraint violation
        return res
          .status(400)
          .json({ error: "Price for this vehicle type already exists" });
      }
      res.status(500).json({ error: "Failed to add price" });
    }
  }
);

/**
 * PUT /api/carwash-catalog/admin/prices/:id
 * Update price
 * Manager only
 */
router.put(
  "/admin/prices/:id",
  authenticateToken,
  requireManager,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { vehicle_type, price, is_active } = req.body;

      const updateQuery = `
      UPDATE carwash_service_prices
      SET 
        vehicle_type = COALESCE($1, vehicle_type),
        price = COALESCE($2, price),
        is_active = COALESCE($3, is_active),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

      const { rows } = await pool.query(updateQuery, [
        vehicle_type,
        price,
        is_active,
        id,
      ]);

      if (rows.length === 0) {
        return res.status(404).json({ error: "Price not found" });
      }

      res.json(rows[0]);
    } catch (error) {
      console.error("Error updating price:", error);
      res.status(500).json({ error: "Failed to update price" });
    }
  }
);

/**
 * DELETE /api/carwash-catalog/admin/prices/:id
 * Delete price
 * Manager only
 */
router.delete(
  "/admin/prices/:id",
  authenticateToken,
  requireManager,
  async (req, res) => {
    try {
      const { id } = req.params;

      const deleteQuery =
        "DELETE FROM carwash_service_prices WHERE id = $1 RETURNING *";
      const { rows } = await pool.query(deleteQuery, [id]);

      if (rows.length === 0) {
        return res.status(404).json({ error: "Price not found" });
      }

      res.json({ message: "Price deleted successfully", price: rows[0] });
    } catch (error) {
      console.error("Error deleting price:", error);
      res.status(500).json({ error: "Failed to delete price" });
    }
  }
);

module.exports = router;
