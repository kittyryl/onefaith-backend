const express = require("express");
const router = express.Router();
const db = require("./db");
const logger = require("./logger");
const { sendSms } = require("./sms");

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
      `SELECT 
        cs.order_id, 
        cs.order_id_fk, 
        cs.created_at, 
        cs.status, 
        cs.started_at, 
        cs.completed_at, 
        cs.cancelled_at, 
        cs.vehicle_type, 
        cs.plate_number, 
        cs.customer_name, 
        cs.customer_phone, 
        cs.cancel_reason, 
        cs.payment_method, 
        cs.total, 
        cs.items,
        COALESCE(
          json_agg(
            json_build_object(
              'catalog_service_id', li.catalog_service_id,
              'service_name', cat.name,
              'vehicle_type', li.vehicle_type,
              'unit_price', li.unit_price,
              'quantity', li.quantity,
              'line_total', li.line_total
            )
          ) FILTER (WHERE li.id IS NOT NULL),
          '[]'::json
        ) as line_items
       FROM carwash_services cs
       LEFT JOIN carwash_service_line_items li ON cs.id = li.service_ticket_id
       LEFT JOIN carwash_services_catalog cat ON li.catalog_service_id = cat.id
       GROUP BY cs.id, cs.order_id, cs.order_id_fk, cs.created_at, cs.status, cs.started_at, 
                cs.completed_at, cs.cancelled_at, cs.vehicle_type, cs.plate_number, 
                cs.customer_name, cs.customer_phone, cs.cancel_reason, cs.payment_method, 
                cs.total, cs.items
       ORDER BY cs.created_at DESC`
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
      line_items: r.line_items || [],
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

  // Log the incoming request for debugging
  logger.info("Carwash service creation request", {
    order_id,
    vehicle_type: `"${vehicle_type}"`,
    customer_phone: customer_phone ? `"${customer_phone}"` : null,
    itemCount: items?.length,
    total,
    status,
  });

  // Validation
  if (!order_id) {
    logger.warn("Carwash service creation failed: Missing order_id");
    return res.status(400).json({ message: "Order ID is required" });
  }

  // Validate vehicle type if provided: relax to allow any non-empty string up to 50 chars
  if (vehicle_type && vehicle_type.trim()) {
    const normalizedVehicleType = vehicle_type.trim();
    if (normalizedVehicleType.length > 50) {
      logger.warn("Carwash service creation failed: Vehicle type too long", {
        vehicle_type,
      });
      return res
        .status(400)
        .json({ message: "Vehicle type must be 50 characters or less" });
    }
  }

  // Validate customer name length
  if (customer_name && customer_name.length > 100) {
    logger.warn("Carwash service creation failed: Customer name too long");
    return res
      .status(400)
      .json({ message: "Customer name must be 100 characters or less" });
  }

  // Validate phone number format (Philippine format +639XXXXXXXXX or 09XXXXXXXXX)
  // Only validate if phone is provided and not empty
  if (
    customer_phone &&
    customer_phone.trim() &&
    customer_phone.trim().length > 0
  ) {
    const phoneRegex = /^(\+639|09)\d{9}$/;
    const cleanPhone = customer_phone.replace(/[\s\-()]/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      logger.warn("Carwash service creation failed: Invalid phone format", {
        customer_phone,
        cleanPhone,
      });
      return res.status(400).json({
        message: `Phone number must be in format: +639XXXXXXXXX or 09XXXXXXXXX. Received: ${cleanPhone}`,
      });
    }
  }

  // Validate plate number length
  if (plate_number && plate_number.length > 20) {
    logger.warn("Carwash service creation failed: Plate number too long");
    return res
      .status(400)
      .json({ message: "Plate number must be 20 characters or less" });
  }

  // Validate total
  if (isNaN(total) || total < 0) {
    logger.warn("Carwash service creation failed: Invalid total", { total });
    return res.status(400).json({ message: "Total must be a positive number" });
  }

  // Validate items
  if (!Array.isArray(items) || items.length === 0) {
    logger.warn("Carwash service creation failed: No items provided");
    return res
      .status(400)
      .json({ message: "At least one service item is required" });
  }

  try {
    await ensureTable();

    // Start transaction to insert both service ticket and line items
    const client = await db.getClient();
    try {
      await client.query("BEGIN");

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
          status = CASE WHEN carwash_services.status = 'cancelled' THEN carwash_services.status ELSE EXCLUDED.status END
        RETURNING id;
      `;
      const serviceResult = await client.query(upsertSQL, [
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

      const serviceTicketId = serviceResult.rows[0].id;

      // Delete existing line items on conflict (for upsert behavior)
      await client.query(
        "DELETE FROM carwash_service_line_items WHERE service_ticket_id = $1",
        [serviceTicketId]
      );

      // Insert line items linking to catalog
      if (items && items.length > 0) {
        const lineItemSQL = `
          INSERT INTO carwash_service_line_items (service_ticket_id, catalog_service_id, vehicle_type, unit_price, quantity, line_total)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        for (const item of items) {
          const catalogServiceId = item.serviceId
            ? parseInt(item.serviceId)
            : null;
          const itemVehicle = item.vehicle || vehicle_type;
          const unitPrice = Number(item.price) || 0;
          const qty = item.quantity || 1;
          const lineTotal = unitPrice * qty;

          await client.query(lineItemSQL, [
            serviceTicketId,
            catalogServiceId,
            itemVehicle,
            unitPrice,
            qty,
            lineTotal,
          ]);
        }
      }

      await client.query("COMMIT");
      logger.info("Carwash service ticket upserted", {
        order_id,
        serviceTicketId,
        total,
        itemCount: items.length,
      });
      res.status(201).json({ message: "Service ticket upserted", order_id });
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error(
        "Failed to upsert carwash service - transaction rolled back",
        {
          error: err.message,
          stack: err.stack,
          order_id,
        }
      );
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error("Carwash service creation error", {
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      message: "Failed to create service. Please try again.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// Link a carwash service ticket to a paid order (set FK)
router.patch("/services/:id/link-order", async (req, res) => {
  const ticketId = req.params.id; // matches TEXT order_id (e.g., "ORD-abc123")
  const { order_id } = req.body || {}; // DB orders.id (INTEGER from SERIAL)

  logger.info("Link order request received", {
    ticketId,
    order_id,
    order_id_type: typeof order_id,
    body: req.body,
  });

  if (!order_id || order_id === null || order_id === undefined) {
    logger.warn("Link order failed: Missing or null order_id", { 
      ticketId, 
      order_id,
      receivedBody: req.body 
    });
    return res.status(400).json({ 
      message: `order_id is required. Received: ${JSON.stringify(order_id)}` 
    });
  }

  // Detect column type of carwash_services.order_id_fk to coerce correctly (uuid vs integer)
  let targetType = null;
  try {
    const typeRes = await db.query(
      `SELECT data_type
         FROM information_schema.columns
        WHERE table_name = 'carwash_services'
          AND column_name = 'order_id_fk'
        LIMIT 1`
    );
    targetType = typeRes.rows[0]?.data_type || null;
  } catch (e) {
    logger.warn("Failed to detect order_id_fk column type; proceeding best-effort", {
      error: e.message,
    });
  }

  // Coerce order_id based on targetType
  let coercedOrderId = order_id;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (targetType && targetType.includes("uuid")) {
    // Expect UUID
    if (typeof order_id !== "string" || !uuidRegex.test(order_id)) {
      logger.warn("Link order failed: Expected UUID for order_id_fk", {
        ticketId,
        order_id,
        targetType,
      });
      return res.status(400).json({
        message: `order_id must be a valid UUID. Received: ${JSON.stringify(order_id)}`,
      });
    }
  } else if (targetType && (targetType.includes("integer") || targetType.includes("int"))) {
    // Expect integer
    const parsed = typeof order_id === "string" ? parseInt(order_id, 10) : order_id;
    if (isNaN(parsed)) {
      logger.warn("Link order failed: Expected integer for order_id_fk", {
        ticketId,
        order_id,
        targetType,
      });
      return res.status(400).json({
        message: `order_id must be a valid integer. Received: ${JSON.stringify(order_id)}`,
      });
    }
    coercedOrderId = parsed;
  } else {
    // Unknown type, best effort: if number-like, coerce to int; else pass-through
    if (typeof order_id === "string" && /^\d+$/.test(order_id)) {
      coercedOrderId = parseInt(order_id, 10);
    }
  }

  try {
    await ensureTable();
  logger.info("Linking carwash ticket to order", { ticketId, order_id: coercedOrderId, targetType });

    const sql = `
      UPDATE carwash_services
         SET order_id_fk = $2
       WHERE (TRIM(order_id) = TRIM($1) OR UPPER(TRIM(order_id)) = UPPER(TRIM($1)))
       RETURNING order_id, order_id_fk;
    `;
  const result = await db.query(sql, [ticketId, coercedOrderId]);

    if (result.rowCount === 0) {
      logger.warn("Link order failed: Service not found", { ticketId });
      return res.status(404).json({ message: "Service not found" });
    }

    logger.info("Successfully linked carwash ticket to order", {
      ticketId,
      order_id: coercedOrderId,
      linkedService: result.rows[0],
    });
    res.json({ success: true, service: result.rows[0] });
  } catch (err) {
    logger.error("Link order error", {
      error: err.message,
      stack: err.stack,
      ticketId,
      order_id: coercedOrderId,
      targetType
    });
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

    // First, get the service details including customer phone
    const getServiceSQL = `
      SELECT order_id, customer_name, customer_phone, vehicle_type, plate_number
      FROM carwash_services
      WHERE (TRIM(order_id) = TRIM($1) OR UPPER(TRIM(order_id)) = UPPER(TRIM($1)))
        AND status = 'in_progress'
    `;
    const serviceData = await db.query(getServiceSQL, [orderId]);

    if (serviceData.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Service not found or not in progress" });
    }

    const service = serviceData.rows[0];

    // Update the service to completed
    const sql = `
      UPDATE carwash_services
      SET status = 'completed', completed_at = NOW()
      WHERE (TRIM(order_id) = TRIM($1) OR UPPER(TRIM(order_id)) = UPPER(TRIM($1)))
        AND status = 'in_progress'
      RETURNING order_id, status, completed_at, customer_name, customer_phone;
    `;
    const result = await db.query(sql, [orderId]);

    // Send SMS notification if customer phone is available
    if (service.customer_phone && service.customer_phone.trim()) {
      const customerName = service.customer_name || "Valued Customer";
      const vehicleInfo = service.plate_number
        ? `${service.vehicle_type || "Vehicle"} (${service.plate_number})`
        : service.vehicle_type || "Your vehicle";

      const smsBody = `Hi ${customerName}! Your carwash service for ${vehicleInfo} is now complete and ready for pickup. Thank you for choosing OneFaith Carwash!`;

      // Send SMS asynchronously (don't block the response)
      sendSms({
        to: service.customer_phone,
        body: smsBody,
      })
        .then((smsResult) => {
          if (smsResult.success) {
            logger.info(`SMS sent successfully for completed carwash service`, {
              orderId,
              phone: service.customer_phone,
              sid: smsResult.sid,
            });
          } else if (!smsResult.skipped) {
            logger.warn(`Failed to send SMS for completed carwash service`, {
              orderId,
              phone: service.customer_phone,
              error: smsResult.error,
            });
          }
        })
        .catch((err) => {
          logger.error(`Error sending SMS for completed carwash service`, {
            orderId,
            error: err.message,
          });
        });
    } else {
      logger.info(`No phone number available for SMS notification`, {
        orderId,
      });
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
