const db = require("./db");

async function useCappuccinoImage() {
  console.log("Updating placeholder images with Cappuccino image...\n");

  // Get the Cappuccino image URL
  const cappuccino = await db.query(
    "SELECT image_url FROM products WHERE name = 'Cappuccino'"
  );

  if (!cappuccino.rows[0]) {
    console.error("❌ Cappuccino product not found!");
    process.exit(1);
  }

  const cappuccinoImage = cappuccino.rows[0].image_url;
  console.log(`Using Cappuccino image: ${cappuccinoImage}\n`);

  // Update all products with placeholder
  const placeholder = "/images/placeholder.svg";

  const productsToUpdate = await db.query(
    "SELECT id, name, category FROM products WHERE image_url = $1",
    [placeholder]
  );

  console.log(
    `Found ${productsToUpdate.rows.length} products with placeholder:\n`
  );

  for (const product of productsToUpdate.rows) {
    await db.query("UPDATE products SET image_url = $1 WHERE id = $2", [
      cappuccinoImage,
      product.id,
    ]);
    console.log(`✓ ${product.name} (${product.category})`);
  }

  console.log(
    `\n✅ Updated ${productsToUpdate.rows.length} products with Cappuccino image`
  );

  process.exit(0);
}

useCappuccinoImage().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
