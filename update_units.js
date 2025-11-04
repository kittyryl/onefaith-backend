const db = require("./db");

async function updateUnits() {
  console.log("Updating units of measure...\n");

  try {
    // Update NONE-FOOD items to 'pcs'
    const res1 = await db.query(
      "UPDATE ingredients SET unit_of_measure = 'pcs' WHERE category = 'NONE-FOOD'"
    );
    console.log(`✓ Updated ${res1.rowCount} NONE-FOOD items to 'pcs'`);

    // Update all other items to 'bottle'
    const res2 = await db.query(
      "UPDATE ingredients SET unit_of_measure = 'bottle' WHERE category != 'NONE-FOOD'"
    );
    console.log(`✓ Updated ${res2.rowCount} other items to 'bottle'`);

    // Show summary
    const summary = await db.query(`
      SELECT unit_of_measure, COUNT(*) as count 
      FROM ingredients 
      GROUP BY unit_of_measure 
      ORDER BY unit_of_measure
    `);

    console.log("\n📊 Summary by unit:");
    summary.rows.forEach((r) => {
      console.log(`  ${r.unit_of_measure}: ${r.count} items`);
    });

    const total = await db.query("SELECT COUNT(*) as total FROM ingredients");
    console.log(`\n✅ Total: ${total.rows[0].total} ingredients updated`);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

updateUnits();
