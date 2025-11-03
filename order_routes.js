// pos-backend/order_routes.js

const express = require("express");
const router = express.Router();
const db = require("./db");

// POST route to save a new completed order
router.post("/", async (req, res) => {
  // The request body contains the entire order object from the frontend
  const { orderDetails, businessUnit } = req.body;

  // Deconstruct the order for the 'orders' table
  // We are looking for 'discount_type' from the frontend payload
  const {
    subtotal,
    discount,
    total,
    payment,
    cashTendered,
    changeDue,
    order_type, // This is for Coffee POS
    discount_type, // This is the fix
    items,
  } = orderDetails;

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN"); // START TRANSACTION

    // 1. INSERT into the 'orders' table
    const orderInsertQuery = `
            INSERT INTO orders (
                subtotal, discount, total, payment_method, 
                cash_tendered, change_due, order_type, discount_type
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING id;
        `;

    // Pass the destructured 'discount_type' into the query values
    const orderValues = [
      subtotal,
      discount,
      total,
      payment,
      cashTendered,
      changeDue,
      order_type || null, // Use order_type (Dine in/Take out) or null (for Carwash)
      discount_type || null, // Use the discount_type or null
    ];

    const orderResult = await client.query(orderInsertQuery, orderValues);
    const orderId = orderResult.rows[0].id;

    // 2. INSERT all items into the 'order_items' table
    const itemInsertQuery = `
            INSERT INTO order_items (
                order_id, business_unit, item_type, unit_price, quantity, line_total, item_details
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7);
        `;

    for (const item of items) {
      const itemType = businessUnit === "Coffee" ? item.name : item.serviceName;

      const itemDetails =
        businessUnit === "Coffee"
          ? { option: item.option }
          : { vehicle: item.vehicle };

      const lineTotal = item.price * item.quantity;

      const itemValues = [
        orderId,
        businessUnit,
        itemType,
        item.price,
        item.quantity,
        lineTotal,
        JSON.stringify(itemDetails),
      ];

      await client.query(itemInsertQuery, itemValues);
    }

    await client.query("COMMIT"); // END TRANSACTION (Success!)
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
