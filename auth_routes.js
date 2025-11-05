const express = require("express");
const router = express.Router();
const db = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "24h";

// Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }

  try {
    const query = "SELECT * FROM users WHERE username = $1 AND is_active = true";
    const result = await db.query(query, [username]);

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

// Verify token
router.get("/verify", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user still exists and is active
    const query = "SELECT id, username, full_name, role FROM users WHERE id = $1 AND is_active = true";
    const result = await db.query(query, [decoded.userId]);

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "User not found or inactive" });
    }

    const user = result.rows[0];
    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(401).json({ message: "Invalid token", valid: false });
  }
});

// Get all users (manager only)
router.get("/users", async (req, res) => {
  try {
    const query = `
      SELECT id, username, full_name, role, is_active, created_at
      FROM users
      ORDER BY created_at DESC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Create user (manager only)
router.post("/users", async (req, res) => {
  const { username, password, fullName, role } = req.body;

  if (!username || !password || !fullName || !role) {
    return res.status(400).json({ message: "All fields required" });
  }

  if (!["manager", "staff"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO users (username, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, full_name, role, is_active, created_at
    `;
    const result = await db.query(query, [username, passwordHash, fullName, role]);
    res.status(201).json({
      message: "User created successfully",
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      // Unique violation
      return res.status(409).json({ message: "Username already exists" });
    }
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
});

// Update user (manager only)
router.put("/users/:id", async (req, res) => {
  const { id } = req.params;
  const { fullName, role, isActive, password } = req.body;

  try {
    let query;
    let values;

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      query = `
        UPDATE users
        SET full_name = $1, role = $2, is_active = $3, password_hash = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING id, username, full_name, role, is_active
      `;
      values = [fullName, role, isActive, passwordHash, id];
    } else {
      query = `
        UPDATE users
        SET full_name = $1, role = $2, is_active = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING id, username, full_name, role, is_active
      `;
      values = [fullName, role, isActive, id];
    }

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "User updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
});

// Delete user (manager only)
router.delete("/users/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      "DELETE FROM users WHERE id = $1 RETURNING username",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

module.exports = router;
