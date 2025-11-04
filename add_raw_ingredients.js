const db = require("./db");

const rawIngredients = [
  // NONE-FOOD (Particulars)
  {
    name: "16 OZ CUP",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 1000,
  },
  {
    name: "FLAT LIDS",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 1000,
  },
  {
    name: "DOMELIDS",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 1000,
  },
  {
    name: "DOUBLE WALL 12 OZ BLACK",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 500,
  },
  {
    name: "HOT CUP LID",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 500,
  },
  {
    name: "BENDABLE STRAW",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 1000,
  },
  {
    name: "PEARL STRAW",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 1000,
  },
  {
    name: "TISSUE",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 5,
  },
  {
    name: "STIRRER",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 2,
  },
  {
    name: "BLACK SPORK",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 10,
  },
  {
    name: "BOTTLED WATER",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 10,
  },
  {
    name: "THERMAL PAPER",
    category: "NONE-FOOD",
    unit_of_measure: "rolls",
    required_stock: 5,
  },
  {
    name: "TAKEOUT BOX",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 5,
  },
  {
    name: "PLASTIC SPOON",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 5,
  },
  {
    name: "PLASTIC FORK",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 5,
  },
  {
    name: "PAPER BAG",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 50,
  },
  {
    name: "TRASH BAG",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 2,
  },
  {
    name: "8 oz HOT CUPS",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 0,
  },
  {
    name: "8 oz LID HOT",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 0,
  },
  {
    name: "12 oz LID COLD",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 0,
  },
  {
    name: "12oz COLD CUPS",
    category: "NONE-FOOD",
    unit_of_measure: "pcs",
    required_stock: 0,
  },

  // JAMS
  {
    name: "BLUEBERRY",
    category: "JAMS",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "STRAWBERRY",
    category: "JAMS",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "PASSION FRUIT",
    category: "JAMS",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  { name: "MANGO", category: "JAMS", unit_of_measure: "kg", required_stock: 2 },
  {
    name: "DRAGON FRUIT",
    category: "JAMS",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  { name: "GUAVA", category: "JAMS", unit_of_measure: "kg", required_stock: 2 },
  {
    name: "LYCHEE",
    category: "JAMS",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  { name: "PEACH", category: "JAMS", unit_of_measure: "kg", required_stock: 2 },
  {
    name: "PINEAPPLE",
    category: "JAMS",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "MIX TROPICAL",
    category: "JAMS",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "GREEN GRAPE",
    category: "JAMS",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "MULBERRY",
    category: "JAMS",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "GRAPEFRUIT",
    category: "JAMS",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "HONEYDEW PUREE",
    category: "JAMS",
    unit_of_measure: "kg",
    required_stock: 2,
  },

  // TEA
  {
    name: "CEYLON BLACK TEA",
    category: "TEA",
    unit_of_measure: "packs",
    required_stock: 0,
  },
  {
    name: "JASMINE #3 GREEN TEA",
    category: "TEA",
    unit_of_measure: "packs",
    required_stock: 0,
  },

  // SAUCE (Chocolate varieties)
  {
    name: "CHOCOLATE - DAIKKA",
    category: "SAUCE",
    unit_of_measure: "kg",
    required_stock: 0,
  },
  {
    name: "CHOCOLATE - DAVINCI",
    category: "SAUCE",
    unit_of_measure: "kg",
    required_stock: 0,
  },
  {
    name: "CHOCOLATE - HERSHEYS",
    category: "SAUCE",
    unit_of_measure: "kg",
    required_stock: 0,
  },
  {
    name: "CARAMEL - DAIKKA",
    category: "SAUCE",
    unit_of_measure: "kg",
    required_stock: 0,
  },
  {
    name: "CARAMEL - DAVINCI",
    category: "SAUCE",
    unit_of_measure: "kg",
    required_stock: 0,
  },
  {
    name: "WHITE CHOCOLATE - DAIKKA",
    category: "SAUCE",
    unit_of_measure: "kg",
    required_stock: 0,
  },
  {
    name: "WHITE CHOCOLATE - DAVINCI",
    category: "SAUCE",
    unit_of_measure: "kg",
    required_stock: 0,
  },
  {
    name: "CONDENSED MILK",
    category: "SAUCE",
    unit_of_measure: "cans",
    required_stock: 0,
  },
  {
    name: "WHIP CREAM",
    category: "SAUCE",
    unit_of_measure: "cans",
    required_stock: 0,
  },
  {
    name: "COLD BREW",
    category: "SAUCE",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "CARAMEL DRIZZLE",
    category: "SAUCE",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "SALTED CARAMEL",
    category: "SAUCE",
    unit_of_measure: "bottles",
    required_stock: 0,
  },

  // SINKERS
  {
    name: "BLACK PEARL",
    category: "SINKERS",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "NATA",
    category: "SINKERS",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "FRUIT JELLY",
    category: "SINKERS",
    unit_of_measure: "kg",
    required_stock: 2,
  },

  // LIQUOR
  {
    name: "JACK DANIELS",
    category: "LIQUOR",
    unit_of_measure: "bottles",
    required_stock: 1,
  },
  {
    name: "BAILEYS",
    category: "LIQUOR",
    unit_of_measure: "bottles",
    required_stock: 1,
  },
  {
    name: "MOLLYS",
    category: "LIQUOR",
    unit_of_measure: "bottles",
    required_stock: 1,
  },
  {
    name: "JAMESON",
    category: "LIQUOR",
    unit_of_measure: "bottles",
    required_stock: 1,
  },
  {
    name: "STOLI VANILLA",
    category: "LIQUOR",
    unit_of_measure: "bottles",
    required_stock: 1,
  },

  // SYRUPS
  {
    name: "HAZELNUT/ DVG",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "VANILLA/ DVG",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "CARAMEL/ DVG",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "SALTED CARAMEL",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "TARO",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "STRAWBERRY",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "LEMON SYRUP",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "SUGAR/FRUCTOSE",
    category: "SYRUPS",
    unit_of_measure: "kg",
    required_stock: 0,
  },
  {
    name: "ORANGE",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "KIWI SYRUP",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "YOGURT",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "PASSION",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "MANGO",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "WINTERMELON",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "BROWN SUGAR",
    category: "SYRUPS",
    unit_of_measure: "kg",
    required_stock: 0,
  },
  {
    name: "LYCHEE",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "GREEN APPLE",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "BLUE CURACAO",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "ALMOND / DVG",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "WHITE CHOCO/ DVG",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },
  {
    name: "POMELO",
    category: "SYRUPS",
    unit_of_measure: "bottles",
    required_stock: 0,
  },

  // POWDER
  {
    name: "MILK POWDER",
    category: "POWDER",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "90A CREAMER",
    category: "POWDER",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "PUDDING POWDER",
    category: "POWDER",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "ESPRESSO POWDER",
    category: "POWDER",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "CARAMEL POWDER",
    category: "POWDER",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "GRASS POWDER",
    category: "POWDER",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "CAKE CREAM POWDER",
    category: "POWDER",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "MATCHA POWDER",
    category: "POWDER",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "TARO POWDER",
    category: "POWDER",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "COCOA POWDER",
    category: "POWDER",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "SMOOTHIE POWDER",
    category: "POWDER",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "CRUSHED BISCUITS (CHIPS)",
    category: "POWDER",
    unit_of_measure: "kg",
    required_stock: 2,
  },
  {
    name: "CHOCOLATE CHIPS",
    category: "POWDER",
    unit_of_measure: "kg",
    required_stock: 2,
  },

  // COFFEE
  {
    name: "BEANS",
    category: "COFFEE",
    unit_of_measure: "kg",
    required_stock: 0,
  },
  {
    name: "MILK",
    category: "COFFEE",
    unit_of_measure: "liters",
    required_stock: 0,
  },
  {
    name: "EVER WHIP",
    category: "COFFEE",
    unit_of_measure: "cans",
    required_stock: 0,
  },
  {
    name: "OATSIDE",
    category: "COFFEE",
    unit_of_measure: "liters",
    required_stock: 0,
  },
];

async function addIngredients() {
  console.log(`Adding ${rawIngredients.length} raw ingredients...\n`);

  let addedCount = 0;
  let updatedCount = 0;

  for (const ingredient of rawIngredients) {
    try {
      const result = await db.query(
        `INSERT INTO ingredients (name, category, unit_of_measure, required_stock, current_stock) 
         VALUES ($1, $2, $3, $4, 0) 
         ON CONFLICT (name) DO UPDATE SET 
           category = EXCLUDED.category,
           unit_of_measure = EXCLUDED.unit_of_measure,
           required_stock = EXCLUDED.required_stock
         RETURNING id, name, category, (xmax = 0) AS inserted`,
        [
          ingredient.name,
          ingredient.category,
          ingredient.unit_of_measure,
          ingredient.required_stock,
        ]
      );

      if (result.rows[0].inserted) {
        console.log(`✓ Added: ${ingredient.name} (${ingredient.category})`);
        addedCount++;
      } else {
        console.log(`↻ Updated: ${ingredient.name} (${ingredient.category})`);
        updatedCount++;
      }
    } catch (err) {
      console.error(`✗ Failed to add ${ingredient.name}:`, err.message);
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Added: ${addedCount} new ingredients`);
  console.log(`   Updated: ${updatedCount} existing ingredients`);

  // Show summary
  const summary = await db.query(
    `SELECT category, COUNT(*) as count 
     FROM ingredients 
     GROUP BY category 
     ORDER BY category`
  );

  console.log("\n📊 Ingredients by category:");
  summary.rows.forEach((row) => {
    console.log(`  ${row.category}: ${row.count} items`);
  });

  const total = await db.query("SELECT COUNT(*) as total FROM ingredients");
  console.log(`\n📦 Total ingredients in database: ${total.rows[0].total}`);

  process.exit(0);
}

addIngredients().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
