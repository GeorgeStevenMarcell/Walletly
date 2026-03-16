"use strict";
const jwt = require("jsonwebtoken");
const { query } = require("../db/postgres");

/** Verify Bearer JWT and attach req.user = { id, username } */
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization header missing or malformed" });
  }
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    next();
  } catch (err) {
    const msg = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    res.status(401).json({ error: msg });
  }
}

/**
 * Verify the authenticated user is a member of the wallet in :walletId.
 * Must be used AFTER authenticate(). Sets req.walletId.
 */
async function requireWalletMember(req, res, next) {
  const walletId = req.params.walletId;
  if (!walletId) return res.status(400).json({ error: "walletId param missing" });
  try {
    const { rowCount } = await query(
      "SELECT 1 FROM wallet_members WHERE wallet_id=$1 AND user_id=$2",
      [walletId, req.user.id]
    );
    if (!rowCount) return res.status(403).json({ error: "Access denied to this wallet" });
    req.walletId = walletId;
    next();
  } catch (err) {
    console.error("[auth] requireWalletMember:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { authenticate, requireWalletMember };
