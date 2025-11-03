const express = require("express");
const cors = require("cors");
const morgan = require("morgan"); // For logging requests
const db = require("./db");

// --- IMPORT ALL ROUTERS ---
const orderRoutes = require("./order_routes");
const ingredientRoutes = require("./ingredient_routes");
const productRoutes = require("./product_routes");
const reportRoutes = require("./report_routes"); // For the sales page

const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE (Must be at the top) ---
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse JSON bodies
app.use(morgan("dev")); // Log all HTTP requests to the console

// --- API ROUTES ---
app.use("/api/orders", orderRoutes);
app.use("/api/ingredients", ingredientRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reports", reportRoutes); // This route handles the sales data

// --- DB Connection Check ---
async function checkDbConnection() {
  try {
    const res = await db.query("SELECT NOW()");
    console.log(`[DB] Successfully connected at: ${res.rows[0].now}`);
  } catch (err) {
    console.error("[DB] FAILED to connect:", err.message);
  }
}

// Default route
app.get("/", (req, res) => {
  res.send("POS Backend API is running!");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  checkDbConnection();
});
