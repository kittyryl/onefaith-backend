const express = require("express");
const router = express.Router();
const db = require("./db");

// Save a completed order
router.post("/", async (req, res) => {
  const { orderDetails, businessUnit } = req.body;

  const {
    subtotal,
    discount,
    total,
    payment,
    cashTendered,
    changeDue,
    order_type,
    discount_type,
    items,
    orderId: external_order_id,
  } = orderDetails;

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    // Resolve user and active shift (nullable if none)
    const userId = req.user && (req.user.userId || req.user.id);
    let shiftId = null;
    try {
      if (userId) {
        const shiftRes = await client.query(
          `SELECT id FROM shifts WHERE user_id = $1 AND status = 'active' ORDER BY start_time DESC LIMIT 1`,
          [userId]
        );
        if (shiftRes.rowCount > 0) {
          shiftId = shiftRes.rows[0].id;
        }
      }
    } catch (e) {
      // Non-fatal: allow orders without shift linkage
      console.warn("[Orders] Failed to resolve active shift:", e.message);
    }

    // Insert order
  const orderInsertQuery = `
      INSERT INTO orders (
        subtotal, discount, total, payment_method,
        cash_tendered, change_due, order_type, discount_type,
        user_id, shift_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id;
    `;

    const orderValues = [
      subtotal,
      discount,
      total,
      payment,
      cashTendered,
      changeDue,
      order_type || null,
      discount_type || null,
      userId || null,
      shiftId || null,
    ];

    const orderResult = await client.query(orderInsertQuery, orderValues);
    const orderId = orderResult.rows[0].id;

    // Insert items
  const itemInsertQuery = `
      INSERT INTO order_items (
        order_id, product_id, business_unit, item_type, unit_price, quantity, line_total, item_details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
    `;

    for (const item of items) {
      const itemType = businessUnit === "Coffee" ? item.name : item.serviceName;

      const itemDetails =
        businessUnit === "Coffee"
          ? { option: item.option }
          : { vehicle: item.vehicle };

      const lineTotal = item.price * item.quantity;

      // Link product_id for Coffee items when available (frontend item.id is product id)
      const productId = businessUnit === "Coffee" && item.id ? item.id : null;

      const itemValues = [
        orderId,
        productId,
        businessUnit,
        itemType,
        item.price,
        item.quantity,
        lineTotal,
        JSON.stringify(itemDetails),
      ];

      await client.query(itemInsertQuery, itemValues);
    }

    // Carwash: upsert ticket payment/total/items without changing status
    if (businessUnit === "Carwash") {
      // Ensure table exists
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
      await client.query(createTableSQL);
      // Add missing columns idempotently
      await client.query(
        "ALTER TABLE carwash_services ADD COLUMN IF NOT EXISTS order_id_fk INT NULL"
      );
      await client.query(
        "ALTER TABLE carwash_services ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ NULL"
      );
      await client.query(
        "ALTER TABLE carwash_services ADD COLUMN IF NOT EXISTS customer_name TEXT NULL"
      );
      await client.query(
        "ALTER TABLE carwash_services ADD COLUMN IF NOT EXISTS customer_phone TEXT NULL"
      );
      await client.query(
        "ALTER TABLE carwash_services ADD COLUMN IF NOT EXISTS cancel_reason TEXT NULL"
      );

      // Map to carwash item shape
      const serviceItems = items.map((it) => ({
        service_name: it.serviceName || it.name || "",
        vehicle: (
          it.vehicle ||
          (it.item_details && it.item_details.vehicle) ||
          (it.itemDetails && it.itemDetails.vehicle) ||
          ""
        ).toString(),
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
      }));

      // Prefer frontend ticket ID; fallback to DB id
      const carwashOrderId = external_order_id || `CWS-${orderId}`;

      // Debug: pre-check status
      try {
        const before = await client.query(
          "SELECT status, completed_at FROM carwash_services WHERE order_id = $1",
          [carwashOrderId]
        );
        if (before.rowCount) {
          console.log(
            `[Carwash][orders] Before upsert for ${carwashOrderId}: status=${before.rows[0].status}, completed_at=${before.rows[0].completed_at}`
          );
        } else {
          console.log(
            `[Carwash][orders] No existing ticket for ${carwashOrderId}`
          );
        }
      } catch (e) {
        console.warn("[Carwash][orders] Pre-check failed:", e.message);
      }

      const upsertSQL = `
        INSERT INTO carwash_services (order_id, payment_method, total, items)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (order_id) DO UPDATE SET
          payment_method = EXCLUDED.payment_method,
          total = EXCLUDED.total,
          items = EXCLUDED.items;
      `;

      await client.query(upsertSQL, [
        carwashOrderId,
        payment,
        total,
        JSON.stringify(serviceItems),
      ]);

      // Debug: post-check status
      try {
        const after = await client.query(
          "SELECT status, completed_at FROM carwash_services WHERE order_id = $1",
          [carwashOrderId]
        );
        if (after.rowCount) {
          console.log(
            `[Carwash][orders] After upsert for ${carwashOrderId}: status=${after.rows[0].status}, completed_at=${after.rows[0].completed_at}`
          );
        }
      } catch (e) {
        console.warn("[Carwash][orders] Post-check failed:", e.message);
      }
    }

    await client.query("COMMIT");
    res.status(201).json({
      message: "Order saved successfully",
      orderId: orderId,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving order:", error.message);
    res.status(500).json({
      message: "Failed to save order",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
