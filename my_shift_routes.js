const express = require("express");
const router = express.Router();
const db = require("./db");

// Helper: resolve today's shift (active or ended) for the current user in Asia/Manila date
async function getTodaysShiftForUser(userId) {
  const q = `
    SELECT s.*
      FROM shifts s
     WHERE s.user_id = $1
       AND (
         DATE(s.start_time AT TIME ZONE 'Asia/Manila') = DATE(NOW() AT TIME ZONE 'Asia/Manila')
         OR (s.end_time IS NOT NULL AND DATE(s.end_time AT TIME ZONE 'Asia/Manila') = DATE(NOW() AT TIME ZONE 'Asia/Manila'))
       )
     ORDER BY COALESCE(s.end_time, s.start_time) DESC
     LIMIT 1;
  `;
  const r = await db.query(q, [userId]);
  return r.rowCount ? r.rows[0] : null;
}

// GET /api/reports/my-shift/summary (mounted under /api/reports/my-shift)
router.get("/summary", async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    console.log("[MyShift] Summary request for userId:", userId);
    const shift = await getTodaysShiftForUser(userId);
    console.log("[MyShift] Today's shift:", shift);

    const whereParts = [
      "o.user_id = $1",
      "DATE(o.created_at AT TIME ZONE 'Asia/Manila') = DATE(NOW() AT TIME ZONE 'Asia/Manila')",
    ];
    const params = [userId];

    if (shift && shift.id) {
      whereParts.push("o.shift_id = $2");
      params.push(shift.id);
    }

    const whereSQL = whereParts.join(" AND ");

    const sql = `
      SELECT 
        COUNT(DISTINCT o.id) AS order_count,
        COALESCE(SUM(o.total), 0) AS total_sales,
        COALESCE(SUM(CASE WHEN oi.business_unit = 'Coffee' THEN oi.line_total ELSE 0 END), 0) AS coffee_sales,
        COALESCE(SUM(CASE WHEN oi.business_unit = 'Carwash' THEN oi.line_total ELSE 0 END), 0) AS carwash_sales,
        COALESCE(SUM(CASE WHEN o.payment_method = 'Cash' THEN o.total ELSE 0 END), 0) AS cash_sales,
        COALESCE(SUM(CASE WHEN o.payment_method = 'Gcash' THEN o.total ELSE 0 END), 0) AS gcash_sales
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE ${whereSQL};
    `;

    const result = await db.query(sql, params);
    const row = result.rows[0] || {};
    
    console.log("[MyShift] Query result:", row);
    console.log("[MyShift] Sending response with orderCount:", Number(row.order_count));

    res.json({
      shift,
      totals: {
        orderCount: Number(row.order_count) || 0,
        totalSales: Number(row.total_sales) || 0,
        byBusinessUnit: {
          Coffee: Number(row.coffee_sales) || 0,
          Carwash: Number(row.carwash_sales) || 0,
        },
        byPayment: {
          Cash: Number(row.cash_sales) || 0,
          Gcash: Number(row.gcash_sales) || 0,
        },
      },
    });
  } catch (err) {
    console.error("[MyShift] summary error:", err);
    res.status(500).json({ message: "Failed to fetch my-shift summary" });
  }
});

// GET /api/reports/my-shift/transactions (mounted under /api/reports/my-shift)
router.get("/transactions", async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { page = "1", size = "10", businessUnit, payment } = req.query;
    const limit = Math.max(parseInt(String(size), 10) || 10, 1);
    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const offset = (pageNum - 1) * limit;

    const shift = await getTodaysShiftForUser(userId);

    const whereParts = [
      "o.user_id = $1",
      "DATE(o.created_at AT TIME ZONE 'Asia/Manila') = DATE(NOW() AT TIME ZONE 'Asia/Manila')",
    ];
    const params = [userId];
    let pIndex = params.length + 1;

    if (shift && shift.id) {
      whereParts.push(`o.shift_id = $${pIndex++}`);
      params.push(shift.id);
    }
    if (businessUnit && (businessUnit === "Coffee" || businessUnit === "Carwash")) {
      whereParts.push(`EXISTS (SELECT 1 FROM order_items oi2 WHERE oi2.order_id = o.id AND oi2.business_unit = $${pIndex++})`);
      params.push(businessUnit);
    }
    if (payment && (payment === "Cash" || payment === "Gcash")) {
      whereParts.push(`o.payment_method = $${pIndex++}`);
      params.push(payment);
    }

    const whereSQL = whereParts.join(" AND ");

    const sql = `
      SELECT 
        o.id AS order_id,
        o.created_at,
        o.total,
        o.payment_method,
        json_agg(
          json_build_object(
            'business_unit', oi.business_unit,
            'item_type', oi.item_type,
            'quantity', oi.quantity,
            'line_total', oi.line_total,
            'details', oi.item_details
          )
        ) AS items
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE ${whereSQL}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    const result = await db.query(sql, params);
    res.json({
      shift,
      page: pageNum,
      size: limit,
      transactions: result.rows,
    });
  } catch (err) {
    console.error("[MyShift] transactions error:", err);
    res.status(500).json({ message: "Failed to fetch my-shift transactions" });
  }
});

module.exports = router;
