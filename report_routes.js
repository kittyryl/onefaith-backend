const express = require("express");
const router = express.Router();
const db = require("./db");

// Sales totals by day per business unit (last 7 days)
router.get("/sales-by-business-by-day", async (req, res) => {
  try {
    const query = `
            SELECT 
                DATE(o.created_at) AS date,
                -- Sum line totals ONLY for 'Coffee'
                SUM(CASE WHEN oi.business_unit = 'Coffee' THEN oi.line_total ELSE 0 END) AS coffee_sales,
                -- Sum line totals ONLY for 'Carwash'
                SUM(CASE WHEN oi.business_unit = 'Carwash' THEN oi.line_total ELSE 0 END) AS carwash_sales
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(o.created_at)
            ORDER BY date ASC;
        `;
    const result = await db.query(query);

    const formattedResult = result.rows.map((row) => ({
      date: row.date,
      coffee_sales: Number(row.coffee_sales) || 0,
      carwash_sales: Number(row.carwash_sales) || 0,
    }));
    res.status(200).json(formattedResult);
  } catch (error) {
    console.error("Error fetching sales by business by day report:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch sales by business data." });
  }
});

// Sales transactions with filters (date range, business unit)
router.get("/summary", async (req, res) => {
  const { startDate, endDate, businessUnit } = req.query;

  let queryParams = [];
  let whereClauses = [];
  let paramIndex = 1;

  if (startDate) {
    whereClauses.push(`o.created_at >= $${paramIndex++}`);
    queryParams.push(startDate);
  }

  if (endDate) {
    const nextDay = new Date(endDate);
    nextDay.setDate(nextDay.getDate() + 1);

    whereClauses.push(`o.created_at < $${paramIndex++}`);
    queryParams.push(nextDay.toISOString().split("T")[0]);
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  let havingString = "";
  if (businessUnit && businessUnit !== "all") {
    havingString = `HAVING $${paramIndex++} = ANY(array_agg(oi.business_unit))`;
    queryParams.push(businessUnit);
  }

  try {
    const query = `
            SELECT 
                o.id AS order_id,
                o.created_at,
                o.total,
                o.discount,
                o.payment_method,
                o.order_type,
                o.discount_type,
                json_agg(
                    DISTINCT jsonb_build_object(
                        'item_type', oi.item_type,
                        'business_unit', oi.business_unit,
                        'quantity', oi.quantity,
                        'line_total', oi.line_total,
                        'details', oi.item_details
                    )
                ) AS items_summary
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            ${whereString} 
            GROUP BY o.id
            ${havingString}
            ORDER BY o.created_at DESC;
        `;

    const result = await db.query(query, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching sales report:", error);
    res.status(500).json({ message: "Failed to fetch sales report data." });
  }
});

module.exports = router;
