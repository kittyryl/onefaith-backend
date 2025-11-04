const db = require("./db");

async function addPlaceholdersForCoffee() {
  console.log("Checking coffee products for placeholder images...\n");

  // Get all coffee-related products
  const coffeeProducts = await db.query(`
    SELECT id, name, category, image_url 
    FROM products 
    WHERE category IN ('Coffee', 'Espresso Bar', 'Non-Coffee')
    ORDER BY category, name
  `);

  const placeholder = "/images/placeholder.svg";
  let updatedCount = 0;

  for (const product of coffeeProducts.rows) {
    if (!product.image_url || product.image_url === "") {
      await db.query("UPDATE products SET image_url = $1 WHERE id = $2", [
        placeholder,
        product.id,
      ]);
      console.log(
        `✓ Added placeholder to: ${product.name} (${product.category})`
      );
      updatedCount++;
    } else {
      console.log(`  ${product.name} already has image: ${product.image_url}`);
    }
  }

  console.log(`\n✅ Updated ${updatedCount} products with placeholder images`);

  // Show summary
  const summary = await db.query(`
    SELECT 
      category,
      COUNT(*) as total,
      COUNT(image_url) as with_images
    FROM products 
    WHERE category IN ('Coffee', 'Espresso Bar', 'Non-Coffee')
    GROUP BY category
    ORDER BY category
  `);

  console.log("\n📊 Coffee products summary:");
  summary.rows.forEach((row) => {
    console.log(
      `  ${row.category}: ${row.with_images}/${row.total} have images`
    );
  });

  process.exit(0);
}

addPlaceholdersForCoffee().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
