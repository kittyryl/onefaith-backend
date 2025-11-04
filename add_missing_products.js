// Script to add missing products from Angel's Coffee menu
const db = require("./db");

const missingProducts = [
  // Coffee-Based
  { name: "White Chocolate Mocha", category: "Coffee", price: 175 },
  { name: "Almond Latte", category: "Coffee", price: 165 },
  { name: "Vanilla Latte", category: "Coffee", price: 165 },
  { name: "Salted Caramel Macchiato", category: "Coffee", price: 175 },
  { name: "Taro Macchiato", category: "Coffee", price: 175 },
  { name: "Blue Macchiato", category: "Coffee", price: 175 },
  { name: "Jack Americano", category: "Coffee", price: 215 },
  { name: "Black Russian", category: "Coffee", price: 215 },
  { name: "Classic Irish Coffee", category: "Coffee", price: 245 },

  // Non-Coffee Based
  { name: "Strawberry Latte", category: "Non-Coffee", price: 165 },

  // Frappe/Smoothie
  { name: "Coffee Caramel", category: "Frappe / Smoothie", price: 175 },
  { name: "Strawberry Matcha", category: "Frappe / Smoothie", price: 175 },
  { name: "Oreo Milk Shake", category: "Frappe / Smoothie", price: 175 },
  { name: "Passion Burst", category: "Frappe / Smoothie", price: 165 },
  { name: "Strawberry Smoothie", category: "Frappe / Smoothie", price: 165 },
  { name: "Frozen Mudslide", category: "Frappe / Smoothie", price: 255 },

  // Milk Tea
  { name: "Strawberry Milk Tea", category: "Milk Tea", price: 125 },
  { name: "Okinawa Milk Tea", category: "Milk Tea", price: 125 },
  { name: "Taro Milk Tea", category: "Milk Tea", price: 125 },
  { name: "Choco Java Chip Milk Tea", category: "Milk Tea", price: 135 },

  // Cheesecake Series
  { name: "Matcha Cheesecake", category: "Cheesecake Series", price: 155 },
  { name: "Blueberry Cheesecake", category: "Cheesecake Series", price: 155 },
  { name: "Strawberry Cheesecake", category: "Cheesecake Series", price: 155 },

  // Yogurt Series
  { name: "Lychee Yogurt", category: "Yogurt Series", price: 155 },
  { name: "Peach Yogurt", category: "Yogurt Series", price: 155 },
  { name: "Strawberry Yogurt", category: "Yogurt Series", price: 155 },

  // Fruitea
  { name: "Passionfruit Tea", category: "Fruitea", price: 155 },
  { name: "Strawberry Fruitea", category: "Fruitea", price: 155 },
  { name: "Dragon Fruitea", category: "Fruitea", price: 155 },
  { name: "Kiwi Lemonade", category: "Refreshers", price: 155 },

  // Mocktails
  { name: "Pineapple Fire", category: "Mocktails", price: 165 },
  { name: "Peach Bomb", category: "Mocktails", price: 165 },
  { name: "Blazing Mango", category: "Mocktails", price: 165 },

  // Refreshers
  { name: "Lychee Peach", category: "Refreshers", price: 155 },
  { name: "Pineapple Passion", category: "Refreshers", price: 155 },
];

async function addProducts() {
  console.log(`Adding ${missingProducts.length} missing products...\n`);

  for (const product of missingProducts) {
    try {
      const result = await db.query(
        `INSERT INTO products (name, category, price) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (name) DO UPDATE SET 
           category = EXCLUDED.category,
           price = EXCLUDED.price
         RETURNING id, name, category, price`,
        [product.name, product.category, product.price]
      );
      console.log(
        `✓ ${product.name} - ₱${product.price} (${product.category})`
      );
    } catch (err) {
      console.error(`✗ Failed to add ${product.name}:`, err.message);
    }
  }

  console.log("\n✅ Product sync complete!");

  // Show summary
  const summary = await db.query(
    `SELECT category, COUNT(*) as count 
     FROM products 
     GROUP BY category 
     ORDER BY category`
  );

  console.log("\n📊 Products by category:");
  summary.rows.forEach((row) => {
    console.log(`  ${row.category}: ${row.count} items`);
  });

  process.exit(0);
}

addProducts().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
