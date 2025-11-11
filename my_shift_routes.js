const express = require("express");
const router = express.Router();
const db = require("./db");

// Helper: resolve the user's current shift: return the most recent active shift (regardless of date),
// or today's ended shift if no active shift exists
async function getCurrentOrTodaysShiftForUser(userId) {
  // 1. Try to find an active shift (not ended) for this user
  const activeQ = `
    SELECT * FROM shifts
     WHERE user_id = $1 AND status = 'active'
     ORDER BY start_time DESC
     LIMIT 1;
  `;
  const activeR = await db.query(activeQ, [userId]);
  if (activeR.rowCount) return activeR.rows[0];

  // 2. If no active shift, return today's ended shift (if any)
  const todayQ = `
    SELECT * FROM shifts
     WHERE user_id = $1
       AND status = 'ended'
       AND DATE(start_time AT TIME ZONE 'Asia/Manila') = DATE(NOW() AT TIME ZONE 'Asia/Manila')
     ORDER BY end_time DESC
     LIMIT 1;
  `;
  const todayR = await db.query(todayQ, [userId]);
  return todayR.rowCount ? todayR.rows[0] : null;
}

// Alias for legacy code compatibility
const getTodaysShiftForUser = getCurrentOrTodaysShiftForUser;

// GET /api/reports/my-shift/summary (mounted under /api/reports/my-shift)
// Returns ONLY today's shift summary for the current user
router.get("/summary", async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    console.log("[MyShift] Summary request for userId:", userId);
    const shift = await getCurrentOrTodaysShiftForUser(userId);
    console.log("[MyShift] Current/Today's shift:", shift);


    const whereParts = [
      "o.user_id = $1",
      "DATE(o.created_at AT TIME ZONE 'Asia/Manila') = DATE(NOW() AT TIME ZONE 'Asia/Manila')",
      "(o.status = 'Completed' OR o.status = 'paid')"
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
    console.log(
      "[MyShift] Sending response with orderCount:",
      Number(row.order_count)
    );

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
// Returns ONLY today's transactions for the current user
const { authenticateToken } = require("./auth_middleware");

router.get("/transactions", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { page = "1", size = "10", businessUnit, payment } = req.query;
    const limit = Math.min(Math.max(parseInt(String(size), 10) || 10, 1), 1000); // Max 1000
    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const offset = (pageNum - 1) * limit;

    const shift = await getTodaysShiftForUser(userId);


    const whereParts = [
      "o.user_id = $1",
      "DATE(o.created_at AT TIME ZONE 'Asia/Manila') = DATE(NOW() AT TIME ZONE 'Asia/Manila')",
      "(o.status = 'Completed' OR o.status = 'paid')"
    ];
    const params = [userId];
    let pIndex = params.length + 1;

    if (shift && shift.id) {
      whereParts.push(`o.shift_id = $${pIndex++}`);
      params.push(shift.id);
    }
    if (
      businessUnit &&
      (businessUnit === "Coffee" || businessUnit === "Carwash")
    ) {
      whereParts.push(
        `EXISTS (SELECT 1 FROM order_items oi2 WHERE oi2.order_id = o.id AND oi2.business_unit = $${pIndex++})`
      );
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

// GET /api/reports/my-shift/all-transactions - Manager-only: all staff shift transactions
router.get("/all-transactions", async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const userRole = req.user.role;

    // Only managers can access this endpoint
    if (userRole !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    const {
      page = "1",
      size = "50",
      staffId,
      businessUnit,
      payment,
      startDate,
      endDate,
    } = req.query;
    const limit = Math.min(Math.max(parseInt(String(size), 10) || 50, 1), 500); // Max 500 for managers
    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const offset = (pageNum - 1) * limit;

    const whereParts = ["1=1"]; // Always true, we'll add conditions
    const params = [];
    let pIndex = 1;

    // Filter by staff member
    if (staffId) {
      whereParts.push(`o.user_id = $${pIndex++}`);
      params.push(staffId);
    }

    // Filter by date range
    if (startDate) {
      whereParts.push(
        `DATE(o.created_at AT TIME ZONE 'Asia/Manila') >= $${pIndex++}`
      );
      params.push(startDate);
    }
    if (endDate) {
      whereParts.push(
        `DATE(o.created_at AT TIME ZONE 'Asia/Manila') <= $${pIndex++}`
      );
      params.push(endDate);
    }

    // Filter by business unit
    if (
      businessUnit &&
      (businessUnit === "Coffee" || businessUnit === "Carwash")
    ) {
      whereParts.push(
        `EXISTS (SELECT 1 FROM order_items oi2 WHERE oi2.order_id = o.id AND oi2.business_unit = $${pIndex++})`
      );
      params.push(businessUnit);
    }

    // Filter by payment method
    if (payment && (payment === "Cash" || payment === "Gcash")) {
      whereParts.push(`o.payment_method = $${pIndex++}`);
      params.push(payment);
    }

    const whereSQL = whereParts.join(" AND ");

    // Count total for pagination
    const countSQL = `
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      WHERE ${whereSQL};
    `;
    const countResult = await db.query(countSQL, params);
    const total = Number(countResult.rows[0]?.total || 0);

    // Aggregates for all matching (not just current page)
    const aggregateSQL = `
      SELECT 
        COALESCE(SUM(o.total), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN oi.business_unit = 'Coffee' THEN oi.line_total ELSE 0 END), 0) AS coffee_item_revenue,
        COALESCE(SUM(CASE WHEN oi.business_unit = 'Carwash' THEN oi.line_total ELSE 0 END), 0) AS carwash_item_revenue
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE ${whereSQL};
    `;
    const aggregateResult = await db.query(aggregateSQL, params);
    const aggregatesRow = aggregateResult.rows[0] || {};

    // Fetch transactions with user info
    const sql = `
      SELECT 
        o.id AS order_id,
        o.created_at,
        o.total,
        o.payment_method,
        o.shift_id,
        o.user_id,
        u.username,
        u.full_name,
        s.start_time as shift_start,
        s.end_time as shift_end,
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
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN shifts s ON s.id = o.shift_id
      WHERE ${whereSQL}
      GROUP BY o.id, u.username, u.full_name, s.start_time, s.end_time
      ORDER BY o.created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    const result = await db.query(sql, params);

    res.json({
      page: pageNum,
      size: limit,
      total,
      totalPages: Math.ceil(total / limit),
      aggregates: {
        totalRevenue: Number(aggregatesRow.total_revenue) || 0,
        coffeeItemRevenue: Number(aggregatesRow.coffee_item_revenue) || 0,
        carwashItemRevenue: Number(aggregatesRow.carwash_item_revenue) || 0,
      },
      transactions: result.rows,
    });
  } catch (err) {
    console.error("[MyShift] all-transactions error:", err);
    res.status(500).json({ message: "Failed to fetch shift transactions" });
  }
});

// GET /api/reports/my-shift/history - Staff sees ALL their shifts with transactions from that day only
router.get("/history", async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { page = "1", size = "20" } = req.query;
    const limit = Math.min(Math.max(parseInt(String(size), 10) || 20, 1), 100); // Max 100
    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const offset = (pageNum - 1) * limit;

    // Get all shifts for this user with their transaction counts and totals (only from that day)
    const sql = `
      SELECT 
        s.id as shift_id,
        s.start_time,
        s.end_time,
        s.status,
        DATE(s.start_time AT TIME ZONE 'Asia/Manila') as shift_date,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(o.total), 0) as total_sales,
        COALESCE(SUM(CASE WHEN oi.business_unit = 'Coffee' THEN oi.line_total ELSE 0 END), 0) AS coffee_sales,
        COALESCE(SUM(CASE WHEN oi.business_unit = 'Carwash' THEN oi.line_total ELSE 0 END), 0) AS carwash_sales,
        COALESCE(SUM(CASE WHEN o.payment_method = 'Cash' THEN o.total ELSE 0 END), 0) AS cash_sales,
        COALESCE(SUM(CASE WHEN o.payment_method = 'Gcash' THEN o.total ELSE 0 END), 0) AS gcash_sales
      FROM shifts s
      LEFT JOIN orders o ON o.shift_id = s.id 
        AND o.user_id = s.user_id
        AND DATE(o.created_at AT TIME ZONE 'Asia/Manila') = DATE(s.start_time AT TIME ZONE 'Asia/Manila')
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE s.user_id = $1
      GROUP BY s.id, s.start_time, s.end_time, s.status
      ORDER BY s.start_time DESC
      LIMIT $2 OFFSET $3;
    `;

    // Count total shifts
    const countSQL = `SELECT COUNT(*) as total FROM shifts WHERE user_id = $1;`;
    const countResult = await db.query(countSQL, [userId]);
    const total = Number(countResult.rows[0]?.total || 0);

    const result = await db.query(sql, [userId, limit, offset]);

    res.json({
      page: pageNum,
      size: limit,
      total,
      totalPages: Math.ceil(total / limit),
      shifts: result.rows.map((row) => ({
        shift_id: row.shift_id,
        start_time: row.start_time,
        end_time: row.end_time,
        status: row.status,
        shift_date: row.shift_date,
        stats: {
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
      })),
    });
  } catch (err) {
    console.error("[MyShift] history error:", err);
    res.status(500).json({ message: "Failed to fetch shift history" });
  }
});

// GET /api/reports/my-shift/shift-transactions/:shiftId - Get transactions for a specific shift on that day only
router.get("/shift-transactions/:shiftId", async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { shiftId } = req.params;

    // Verify the shift belongs to the user and get shift date
    const shiftCheck = await db.query(
      "SELECT id, start_time FROM shifts WHERE id = $1 AND user_id = $2",
      [shiftId, userId]
    );

    if (shiftCheck.rowCount === 0) {
      return res.status(403).json({ message: "Access denied to this shift" });
    }

    const shift = shiftCheck.rows[0];

    // Get transactions for this shift that occurred on the same day as the shift start
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
      WHERE o.shift_id = $1 
        AND o.user_id = $2
        AND DATE(o.created_at AT TIME ZONE 'Asia/Manila') = DATE($3::timestamp AT TIME ZONE 'Asia/Manila')
      GROUP BY o.id
      ORDER BY o.created_at DESC;
    `;

    const result = await db.query(sql, [shiftId, userId, shift.start_time]);

    res.json({
      transactions: result.rows,
    });
  } catch (err) {
    console.error("[MyShift] shift-transactions error:", err);
    res.status(500).json({ message: "Failed to fetch shift transactions" });
  }
});

module.exports = router;
