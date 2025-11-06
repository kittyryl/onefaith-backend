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

// ===== CARWASH ANALYTICS ENDPOINTS =====

// Popular carwash services (completed only)
router.get("/carwash/popular-services", async (req, res) => {
  try {
    const query = `
      SELECT 
        cat.name AS service_name,
        cat.category,
        COUNT(*) AS times_ordered,
        SUM(li.quantity) AS total_quantity,
        SUM(li.line_total) AS total_revenue,
        AVG(li.unit_price) AS avg_price
      FROM carwash_service_line_items li
      JOIN carwash_services cs ON li.service_ticket_id = cs.id
      JOIN carwash_services_catalog cat ON li.catalog_service_id = cat.id
      WHERE cs.status != 'cancelled'
      GROUP BY cat.id, cat.name, cat.category
      ORDER BY times_ordered DESC
      LIMIT 10;
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("[Reports] Popular services error:", err);
    res.status(500).json({ message: "Failed to fetch popular services" });
  }
});

// Cancellation analysis
router.get("/carwash/cancellations", async (req, res) => {
  try {
    const query = `
      SELECT 
        cat.name AS service_name,
        COUNT(*) AS times_cancelled,
        SUM(li.line_total) AS revenue_lost,
        STRING_AGG(DISTINCT cs.cancel_reason, ', ') AS common_reasons
      FROM carwash_service_line_items li
      JOIN carwash_services cs ON li.service_ticket_id = cs.id
      JOIN carwash_services_catalog cat ON li.catalog_service_id = cat.id
      WHERE cs.status = 'cancelled'
      GROUP BY cat.name
      ORDER BY times_cancelled DESC;
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("[Reports] Cancellations error:", err);
    res.status(500).json({ message: "Failed to fetch cancellation stats" });
  }
});

// Services by vehicle type
router.get("/carwash/services-by-vehicle", async (req, res) => {
  try {
    const query = `
      SELECT 
        li.vehicle_type,
        cat.name AS service_name,
        COUNT(*) AS times_ordered,
        SUM(li.line_total) AS revenue
      FROM carwash_service_line_items li
      JOIN carwash_services cs ON li.service_ticket_id = cs.id
      JOIN carwash_services_catalog cat ON li.catalog_service_id = cat.id
      WHERE li.vehicle_type IS NOT NULL
        AND cs.status != 'cancelled'
      GROUP BY li.vehicle_type, cat.name
      ORDER BY li.vehicle_type, times_ordered DESC;
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("[Reports] Services by vehicle error:", err);
    res.status(500).json({ message: "Failed to fetch services by vehicle" });
  }
});

module.exports = router;
