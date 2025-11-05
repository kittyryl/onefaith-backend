const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
}

// Check if user has manager role
function requireManager(req, res, next) {
  if (req.user.role !== "manager") {
    return res.status(403).json({ message: "Manager access required" });
  }
  next();
}

// Check if user has staff or manager role
function requireStaff(req, res, next) {
  if (!["staff", "manager"].includes(req.user.role)) {
    return res.status(403).json({ message: "Staff access required" });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireManager,
  requireStaff,
};
