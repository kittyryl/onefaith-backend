const db = require("./db");

(async () => {
  try {
    // Check ingredients with no audit
    console.log("\n=== Ingredients with no AUDIT ===");
    const noAudit = await db.query(
      `SELECT i.id, i.name, 
        (SELECT COUNT(*) FROM stock_movements WHERE ingredient_id = i.id AND movement_type = 'AUDIT') as audit_count,
        (SELECT COUNT(*) FROM stock_movements WHERE ingredient_id = i.id) as total_movements
       FROM ingredients i 
       WHERE NOT EXISTS (SELECT 1 FROM stock_movements WHERE ingredient_id = i.id AND movement_type = 'AUDIT')
       AND EXISTS (SELECT 1 FROM stock_movements WHERE ingredient_id = i.id)
       LIMIT 5`
    );
    console.log("Ingredients without audit:", noAudit.rows);

    if (noAudit.rows.length > 0) {
      const testId = noAudit.rows[0].id;
      console.log(`\n=== Testing ingredient ${testId} (no audit) ===`);

      const movements = await db.query(
        `SELECT movement_type, quantity, created_at 
         FROM stock_movements 
         WHERE ingredient_id = $1 
         ORDER BY created_at ASC`,
        [testId]
      );
      console.log("Movements:", movements.rows);

      const calc = await db.query(
        `WITH latest_audit AS (
          SELECT DISTINCT ON (ingredient_id) 
            ingredient_id,
            quantity AS audit_quantity,
            created_at AS audit_time
          FROM stock_movements
          WHERE movement_type = 'AUDIT'
          ORDER BY ingredient_id, created_at DESC
        ),
        movements_after_audit AS (
          SELECT 
            sm.ingredient_id,
            SUM(
              CASE 
                WHEN sm.movement_type = 'IN' THEN sm.quantity 
                WHEN sm.movement_type = 'OUT' THEN -sm.quantity
                ELSE 0 
              END
            ) AS net_movement
          FROM stock_movements sm
          LEFT JOIN latest_audit la ON sm.ingredient_id = la.ingredient_id
          WHERE sm.movement_type IN ('IN', 'OUT')
            AND (la.audit_time IS NULL OR sm.created_at > la.audit_time)
          GROUP BY sm.ingredient_id
        )
        SELECT 
          i.id, 
          i.name, 
          COALESCE(la.audit_quantity, 0)::numeric as audit_base,
          COALESCE(maa.net_movement, 0)::numeric as net_after_audit,
          (COALESCE(la.audit_quantity, 0) + COALESCE(maa.net_movement, 0))::numeric AS current_stock
        FROM ingredients i
        LEFT JOIN latest_audit la ON i.id = la.ingredient_id
        LEFT JOIN movements_after_audit maa ON i.id = maa.ingredient_id
        WHERE i.id = $1`,
        [testId]
      );
      console.log("Calculated stock:", calc.rows);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit();
  }
})();
