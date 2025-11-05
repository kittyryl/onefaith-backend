require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const db = require("./db");

// Routers
const authRoutes = require("./auth_routes");
const orderRoutes = require("./order_routes");
const ingredientRoutes = require("./ingredient_routes");
const productRoutes = require("./product_routes");
const reportRoutes = require("./report_routes");
const uploadRoutes = require("./upload_routes");
const carwashRoutes = require("./carwash_routes");
const carwashCatalogRoutes = require("./carwash_catalog_routes");
const shiftRoutes = require("./shift_routes");
const setupRoutes = require("./setup_routes");
const { authenticateToken, requireManager } = require("./auth_middleware");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// CORS: allow explicit origins via CORS_ORIGIN (comma-separated), else allow all (dev)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : "*";
app.use(
  cors({
    origin: allowedOrigins,
  })
);
app.use(express.json());
app.use(morgan("dev"));

// API routes
app.use("/api/auth", authRoutes);
// Gate setup routes behind env flag for safety
if (process.env.ENABLE_SETUP === "true") {
  app.use("/api/setup", setupRoutes);
}
app.use("/api/shifts", shiftRoutes);
app.use("/api/carwash-catalog", carwashCatalogRoutes); // Public for POS, admin endpoints protected
app.use("/api/orders", authenticateToken, orderRoutes);
app.use("/api/ingredients", authenticateToken, ingredientRoutes);
app.use("/api/products", authenticateToken, productRoutes);
app.use("/api/reports", authenticateToken, reportRoutes);
app.use("/api/upload", authenticateToken, uploadRoutes);
app.use("/api/carwash", authenticateToken, carwashRoutes);

// DB health log
async function checkDbConnection() {
  try {
    const res = await db.query("SELECT NOW()");
    console.log(`[DB] Successfully connected at: ${res.rows[0].now}`);
  } catch (err) {
    console.error("[DB] FAILED to connect:", err.message);
  }
}

// Health
app.get("/", (req, res) => {
  res.send("POS Backend API is running!");
});

// Listen
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  checkDbConnection();
});
