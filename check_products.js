const db = require("./db");

async function showSummary() {
  const total = await db.query("SELECT COUNT(*) as total FROM products");
  console.log(`\n✅ Total products in database: ${total.rows[0].total}\n`);

  const byCategory = await db.query(`
    SELECT category, COUNT(*) as count 
    FROM products 
    GROUP BY category 
    ORDER BY category
  `);

  console.log("📊 Products by category:");
  byCategory.rows.forEach((row) => {
    console.log(`  ${row.category}: ${row.count} items`);
  });

  process.exit(0);
}

showSummary();
