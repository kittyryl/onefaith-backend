const express = require("express");
const router = express.Router();
const db = require("./db");

// Ensure table exists
async function ensureTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS carwash_services (
      id SERIAL PRIMARY KEY,
      order_id TEXT UNIQUE NOT NULL,
      order_id_fk INT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'queue',
      started_at TIMESTAMPTZ NULL,
      completed_at TIMESTAMPTZ NULL,
      cancelled_at TIMESTAMPTZ NULL,
      vehicle_type TEXT NULL,
      plate_number TEXT NULL,
      customer_name TEXT NULL,
      customer_phone TEXT NULL,
      cancel_reason TEXT NULL,
      payment_method TEXT NULL,
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      items JSONB NOT NULL DEFAULT '[]'::jsonb
    );
  `;
  await db.query(createTableSQL);
  // Additive migrations
  await db.query(
    "ALTER TABLE carwash_services ADD COLUMN IF NOT EXISTS order_id_fk INT NULL"
  );
  await db.query(
    "ALTER TABLE carwash_services ADD COLUMN IF NOT EXISTS customer_name TEXT NULL;"
  );
  await db.query(
    "ALTER TABLE carwash_services ADD COLUMN IF NOT EXISTS customer_phone TEXT NULL;"
  );
  await db.query(
    "ALTER TABLE carwash_services ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ NULL;"
  );
  await db.query(
    "ALTER TABLE carwash_services ADD COLUMN IF NOT EXISTS cancel_reason TEXT NULL;"
  );
}

// List services
router.get("/services", async (req, res) => {
  try {
    await ensureTable();
    const result = await db.query(
      `SELECT order_id, order_id_fk, created_at, status, started_at, completed_at, cancelled_at, vehicle_type, plate_number, customer_name, customer_phone, cancel_reason, payment_method, total, items
       FROM carwash_services
       ORDER BY created_at DESC`
    );

    // Normalize shape
    const rows = result.rows.map((r) => ({
      order_id: r.order_id,
      order_id_fk: r.order_id_fk,
      created_at: r.created_at,
      status: r.status,
      started_at: r.started_at,
      completed_at: r.completed_at,
      cancelled_at: r.cancelled_at,
      vehicle_type: r.vehicle_type,
      plate_number: r.plate_number,
      customer_name: r.customer_name,
      customer_phone: r.customer_phone,
      cancel_reason: r.cancel_reason,
      payment_method: r.payment_method,
      total: Number(r.total),
      items: Array.isArray(r.items) ? r.items : [],
    }));

    res.json(rows);
  } catch (err) {
    console.error("[Carwash] GET /services error:", err.message);
    res
      .status(500)
      .json({ message: "Failed to fetch services", error: err.message });
  }
});

// Upsert service ticket
router.post("/services", async (req, res) => {
  const {
    order_id,
    vehicle_type = null,
    plate_number = null,
    customer_name = null,
    customer_phone = null,
    payment_method = null,
    total = 0,
    items = [],
    status = "queue",
  } = req.body || {};

  if (!order_id) {
    return res.status(400).json({ message: "order_id is required" });
  }

  try {
    await ensureTable();
    const upsertSQL = `
      INSERT INTO carwash_services (order_id, vehicle_type, plate_number, customer_name, customer_phone, payment_method, total, items, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      ON CONFLICT (order_id) DO UPDATE SET
        vehicle_type = EXCLUDED.vehicle_type,
        plate_number = EXCLUDED.plate_number,
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        payment_method = EXCLUDED.payment_method,
        total = EXCLUDED.total,
        items = EXCLUDED.items,
        status = CASE WHEN carwash_services.status = 'cancelled' THEN carwash_services.status ELSE EXCLUDED.status END;
    `;
    await db.query(upsertSQL, [
      order_id,
      vehicle_type,
      plate_number,
      customer_name,
      customer_phone,
      payment_method,
      total,
      JSON.stringify(items),
      status,
    ]);
    res.status(201).json({ message: "Service ticket upserted", order_id });
  } catch (err) {
    console.error("[Carwash] POST /services error:", err.message);
    res
      .status(500)
      .json({ message: "Failed to create service", error: err.message });
  }
});

// Link a carwash service ticket to a paid order (set FK)
router.patch("/services/:id/link-order", async (req, res) => {
  const ticketId = req.params.id; // matches TEXT order_id
  const { order_id } = req.body || {}; // DB orders.id
  if (!order_id || isNaN(Number(order_id))) {
    return res.status(400).json({ message: "order_id (numeric) is required" });
  }
  try {
    await ensureTable();
    const sql = `
      UPDATE carwash_services
         SET order_id_fk = $2
       WHERE (TRIM(order_id) = TRIM($1) OR UPPER(TRIM(order_id)) = UPPER(TRIM($1)))
       RETURNING order_id, order_id_fk;
    `;
    const result = await db.query(sql, [ticketId, Number(order_id)]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json({ success: true, service: result.rows[0] });
  } catch (err) {
    console.error("[Carwash] PATCH /services/:id/link-order error:", err.message);
    res
      .status(500)
      .json({ message: "Failed to link service to order", error: err.message });
  }
});

// Start service (queue -> in_progress)
router.put("/services/:id/start", async (req, res) => {
  const orderId = req.params.id;
  try {
    await ensureTable();
    const sql = `
      UPDATE carwash_services
      SET status = 'in_progress', started_at = NOW()
  WHERE (TRIM(order_id) = TRIM($1) OR UPPER(TRIM(order_id)) = UPPER(TRIM($1)))
    AND status = 'queue'
      RETURNING order_id, status, started_at;
    `;
    const result = await db.query(sql, [orderId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json({ message: "Service started", service: result.rows[0] });
  } catch (err) {
    console.error("[Carwash] PUT /services/:id/start error:", err.message);
    res
      .status(500)
      .json({ message: "Failed to update service", error: err.message });
  }
});

// Complete service (in_progress -> completed)
router.put("/services/:id/complete", async (req, res) => {
  const orderId = req.params.id;
  try {
    await ensureTable();
    const sql = `
      UPDATE carwash_services
      SET status = 'completed', completed_at = NOW()
  WHERE (TRIM(order_id) = TRIM($1) OR UPPER(TRIM(order_id)) = UPPER(TRIM($1)))
    AND status = 'in_progress'
      RETURNING order_id, status, completed_at;
    `;
    const result = await db.query(sql, [orderId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json({ message: "Service completed", service: result.rows[0] });
  } catch (err) {
    console.error("[Carwash] PUT /services/:id/complete error:", err.message);
    res
      .status(500)
      .json({ message: "Failed to update service", error: err.message });
  }
});

// Cancel service (queue/in_progress -> cancelled)
router.put("/services/:id/cancel", async (req, res) => {
  const orderId = req.params.id;
  const { reason = null } = req.body || {};
  try {
    await ensureTable();
    console.log(
      `[Carwash] Cancel request for order_id=${orderId} reason=${
        reason || "(none)"
      }`
    );
    const sql = `
      UPDATE carwash_services
      SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $2
  WHERE (TRIM(order_id) = TRIM($1) OR UPPER(TRIM(order_id)) = UPPER(TRIM($1)))
    AND status IN ('queue','in_progress')
      RETURNING order_id, status, cancelled_at, cancel_reason;
    `;
    const result = await db.query(sql, [orderId, reason]);
    console.log(
      `[Carwash] Cancel result for ${orderId}: rowCount=${result.rowCount}`
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json({ message: "Service cancelled", service: result.rows[0] });
  } catch (err) {
    console.error("[Carwash] PUT /services/:id/cancel error:", err.message);
    res
      .status(500)
      .json({ message: "Failed to cancel service", error: err.message });
  }
});

// Reopen cancelled service (cancelled -> queue)
router.put("/services/:id/reopen", async (req, res) => {
  const orderId = req.params.id;
  try {
    await ensureTable();
    console.log(`[Carwash] Reopen request for order_id=${orderId}`);
    try {
      const pre = await db.query(
        "SELECT order_id, status FROM carwash_services WHERE TRIM(order_id) = TRIM($1) OR UPPER(TRIM(order_id)) = UPPER(TRIM($1))",
        [orderId]
      );
      console.log(`[Carwash] Reopen pre-check rowCount=${pre.rowCount}`);
      if (pre.rowCount) {
        console.log(
          `[Carwash] Reopen pre-check match: order_id=${pre.rows[0].order_id}, status=${pre.rows[0].status}`
        );
      }
    } catch (e) {
      console.warn("[Carwash] Reopen pre-check failed:", e.message);
    }
    const sql = `
      UPDATE carwash_services
      SET status = 'queue', cancelled_at = NULL, cancel_reason = NULL, started_at = NULL, completed_at = NULL
      WHERE (TRIM(order_id) = TRIM($1) OR UPPER(TRIM(order_id)) = UPPER(TRIM($1)))
        AND status = 'cancelled'
      RETURNING order_id, status, cancelled_at, cancel_reason, started_at, completed_at;
    `;
    const result = await db.query(sql, [orderId]);
    console.log(
      `[Carwash] Reopen result for ${orderId}: rowCount=${result.rowCount}`
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json({ message: "Service reopened to queue", service: result.rows[0] });
  } catch (err) {
    console.error("[Carwash] PUT /services/:id/reopen error:", err.message);
    res
      .status(500)
      .json({ message: "Failed to reopen service", error: err.message });
  }
});

module.exports = router;
