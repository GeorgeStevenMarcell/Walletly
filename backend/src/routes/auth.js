"use strict";
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const { query, withTransaction } = require("../db/postgres");
const { validate } = require("../middleware/validate");
const { registerBody, loginBody } = require("../schemas");

const DEFAULT_EXPENSE_CATS = [
  { label:"Food & Dining",  icon:"🍽️", color:"#f59e0b", sort_order:0 },
  { label:"Transport",       icon:"🚗", color:"#3b82f6", sort_order:1 },
  { label:"Shopping",        icon:"🛍️", color:"#ec4899", sort_order:2 },
  { label:"Health",          icon:"💊", color:"#10b981", sort_order:3 },
  { label:"Entertainment",   icon:"🎬", color:"#8b5cf6", sort_order:4 },
  { label:"Utilities",       icon:"⚡", color:"#ef4444", sort_order:5 },
  { label:"Education",       icon:"📚", color:"#06b6d4", sort_order:6 },
  { label:"Other",           icon:"📦", color:"#6b7280", sort_order:7 },
];
const DEFAULT_INCOME_CATS = [
  { label:"Salary",     icon:"💼", color:"#10b981", sort_order:0 },
  { label:"Freelance",  icon:"💻", color:"#3b82f6", sort_order:1 },
  { label:"Investment", icon:"📈", color:"#8b5cf6", sort_order:2 },
  { label:"Gift",       icon:"🎁", color:"#f59e0b", sort_order:3 },
  { label:"Other",      icon:"💰", color:"#6b7280", sort_order:4 },
];

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

// ── POST /api/auth/register ──────────────────────────────────────────────────
router.post("/register", validate(registerBody), async (req, res) => {
  const { username, password, displayName } = req.body;
  try {
    const hash = await bcrypt.hash(password, 12);
    const user = await withTransaction(async (client) => {
      const { rows:[u] } = await client.query(
        `INSERT INTO users (username, display_name, password_hash)
         VALUES ($1,$2,$3) RETURNING id, username, display_name`,
        [username, displayName, hash]
      );
      const { rows:[w] } = await client.query(
        `INSERT INTO wallets (name, owner_id) VALUES ($1,$2) RETURNING id`,
        [`${displayName.trim()}'s Wallet`, u.id]
      );
      await client.query(
        `INSERT INTO wallet_members (wallet_id, user_id) VALUES ($1,$2)`,
        [w.id, u.id]
      );
      for (const c of DEFAULT_EXPENSE_CATS)
        await client.query(
          `INSERT INTO categories (wallet_id,type,label,icon,color,sort_order)
           VALUES ($1,'expense',$2,$3,$4,$5)`,
          [w.id, c.label, c.icon, c.color, c.sort_order]
        );
      for (const c of DEFAULT_INCOME_CATS)
        await client.query(
          `INSERT INTO categories (wallet_id,type,label,icon,color,sort_order)
           VALUES ($1,'income',$2,$3,$4,$5)`,
          [w.id, c.label, c.icon, c.color, c.sort_order]
        );
      return u;
    });
    res.status(201).json({
      token: signToken(user),
      user: { id: user.id, username: user.username, displayName: user.display_name },
    });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Username already taken" });
    console.error("[auth/register]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", validate(loginBody), async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await query(
      `SELECT id, username, display_name, password_hash FROM users WHERE username=$1`,
      [username.toLowerCase().trim()]
    );
    if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });
    const user = rows[0];
    if (!await bcrypt.compare(password, user.password_hash))
      return res.status(401).json({ error: "Invalid credentials" });
    res.json({
      token: signToken(user),
      user: { id: user.id, username: user.username, displayName: user.display_name },
    });
  } catch (err) {
    console.error("[auth/login]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
