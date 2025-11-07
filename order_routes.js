const express = require("express");
const router = express.Router();
const db = require("./db");
const logger = require("./logger");

// Save a completed order
router.post("/", async (req, res) => {
  const { orderDetails, businessUnit } = req.body;

  // Validation
  if (!orderDetails) {
    logger.warn("Order creation failed: Missing orderDetails");
    return res.status(400).json({ message: "Order details are required" });
  }

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

  // Validate required fields
  if (subtotal === undefined || total === undefined || !payment) {
    logger.warn("Order creation failed: Missing required fields", {
      orderDetails,
    });
    return res
      .status(400)
      .json({ message: "Subtotal, total, and payment method are required" });
  }

  // Validate items array
  if (!Array.isArray(items) || items.length === 0) {
    logger.warn("Order creation failed: Empty cart");
    return res
      .status(400)
      .json({ message: "Order must contain at least one item" });
  }

  // Validate numeric values
  if (
    isNaN(subtotal) ||
    isNaN(discount || 0) ||
    isNaN(total) ||
    subtotal < 0 ||
    total < 0
  ) {
    logger.warn("Order creation failed: Invalid amounts", {
      subtotal,
      discount,
      total,
    });
    return res
      .status(400)
      .json({
        message: "Invalid order amounts. Amounts must be positive numbers",
      });
  }

  // Validate payment method
  if (!["Cash", "Gcash"].includes(payment)) {
    logger.warn("Order creation failed: Invalid payment method", { payment });
    return res
      .status(400)
      .json({ message: "Payment method must be Cash or Gcash" });
  }

  // Validate cash payment
  if (payment === "Cash") {
    if (cashTendered === undefined || cashTendered === null) {
      logger.warn("Order creation failed: Missing cash tendered");
      return res
        .status(400)
        .json({
          message: "Cash tendered amount is required for cash payments",
        });
    }
    if (isNaN(cashTendered) || cashTendered < total) {
      logger.warn("Order creation failed: Insufficient cash", {
        cashTendered,
        total,
      });
      return res
        .status(400)
        .json({
          message: "Cash tendered must be greater than or equal to the total",
        });
    }
  }

  // Validate items
  for (const item of items) {
    if (
      !item.quantity ||
      item.quantity <= 0 ||
      !Number.isInteger(item.quantity)
    ) {
      logger.warn("Order creation failed: Invalid item quantity", { item });
      return res
        .status(400)
        .json({ message: "All items must have valid positive quantities" });
    }
    if (isNaN(item.price) || item.price < 0) {
      logger.warn("Order creation failed: Invalid item price", { item });
      return res
        .status(400)
        .json({ message: "All items must have valid prices" });
    }
  }

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
      logger.warn("Failed to resolve active shift", {
        error: e.message,
        userId,
      });
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
          logger.info(`Before upsert for ${carwashOrderId}`, {
            status: before.rows[0].status,
            completed_at: before.rows[0].completed_at,
          });
        } else {
          logger.info(`No existing ticket for ${carwashOrderId}`);
        }
      } catch (err) {
        logger.error("Error checking carwash service status", {
          error: err.message,
        });
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
          logger.info(
            `After upsert for ${carwashOrderId}: status=${after.rows[0].status}, completed_at=${after.rows[0].completed_at}`
          );
        }
      } catch (e) {
        logger.error("Post-check failed:", e.message);
      }
    }

    await client.query("COMMIT");
    logger.info("Order created successfully", {
      orderId,
       external_order_id,
      businessUnit,
      total,
      itemCount: items.length,
      userId,
    });

    res.status(201).json({
      message: "Order saved successfully",
       orderId: orderId, // Always return the database integer ID
       externalOrderId: external_order_id, // Also return the external ID if provided
    });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Failed to create order", {
      error: error.message,
      stack: error.stack,
      businessUnit,
      orderDetails,
    });
    res.status(500).json({
      message: "Failed to save order. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
