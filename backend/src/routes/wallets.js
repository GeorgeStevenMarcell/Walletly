"use strict";
const router = require("express").Router();
const { query, withTransaction } = require("../db/postgres");
const { authenticate, requireWalletMember } = require("../middleware/auth");
const { invalidate } = require("../db/redis");
const { validate } = require("../middleware/validate");
const { createWalletBody, renameWalletBody, walletSettingsBody, inviteMemberBody } = require("../schemas");

router.use(authenticate);

// GET /api/wallets
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT w.id, w.name, w.owner_id, w.month_start_day, w.day_start_hour, w.created_at,
              COALESCE((
                SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
                FROM transactions t
                WHERE t.wallet_id = w.id
                  AND t.txn_date >= (
                    CASE
                      WHEN EXTRACT(DAY FROM CURRENT_DATE) >= w.month_start_day
                      THEN DATE_TRUNC('month', CURRENT_DATE) + (w.month_start_day - 1) * INTERVAL '1 day'
                      ELSE DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') + (w.month_start_day - 1) * INTERVAL '1 day'
                    END
                  )::date
              ), 0) AS period_balance,
              json_agg(json_build_object(
                'id', u.id, 'username', u.username, 'displayName', u.display_name
              ) ORDER BY wm.joined_at) AS members
       FROM wallets w
       JOIN wallet_members wm ON wm.wallet_id = w.id
       JOIN users u ON u.id = wm.user_id
       WHERE w.id IN (SELECT wallet_id FROM wallet_members WHERE user_id=$1)
       GROUP BY w.id ORDER BY w.created_at`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/wallets
router.post("/", validate(createWalletBody), async (req, res, next) => {
  const { name } = req.body;
  try {
    const wallet = await withTransaction(async (c) => {
      const { rows: [w] } = await c.query(
        `INSERT INTO wallets (name, owner_id) VALUES ($1,$2) RETURNING *`,
        [name, req.user.id]
      );
      await c.query(
        `INSERT INTO wallet_members (wallet_id, user_id) VALUES ($1,$2)`,
        [w.id, req.user.id]
      );
      return w;
    });
    res.status(201).json(wallet);
  } catch (err) { next(err); }
});

// PATCH /api/wallets/:walletId  — rename wallet
router.patch("/:walletId", requireWalletMember, validate(renameWalletBody), async (req, res, next) => {
  const { name } = req.body;
  try {
    const { rows: [w] } = await query(
      `UPDATE wallets SET name=$1 WHERE id=$2 AND owner_id=$3 RETURNING *`,
      [name, req.walletId, req.user.id]
    );
    if (!w) return res.status(403).json({ error: "Only the owner can rename this wallet" });
    res.json(w);
  } catch (err) { next(err); }
});

// DELETE /api/wallets/:walletId
router.delete("/:walletId", requireWalletMember, async (req, res, next) => {
  try {
    const { rows: [wallet] } = await query(`SELECT owner_id FROM wallets WHERE id=$1`, [req.walletId]);
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });
    if (wallet.owner_id !== req.user.id)
      return res.status(403).json({ error: "Only the owner can delete this wallet" });

    // Check user has at least one other wallet
    const { rows } = await query(
      `SELECT wallet_id FROM wallet_members WHERE user_id=$1`,
      [req.user.id]
    );
    if (rows.length <= 1)
      return res.status(400).json({ error: "Cannot delete your only wallet" });

    await withTransaction(async (c) => {
      await c.query(`DELETE FROM budgets WHERE wallet_id=$1`, [req.walletId]);
      await c.query(`DELETE FROM transactions WHERE wallet_id=$1`, [req.walletId]);
      await c.query(`DELETE FROM categories WHERE wallet_id=$1`, [req.walletId]);
      await c.query(`DELETE FROM wallet_members WHERE wallet_id=$1`, [req.walletId]);
      await c.query(`DELETE FROM wallets WHERE id=$1`, [req.walletId]);
    });
    await invalidate(`wallet:${req.walletId}:*`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/wallets/:walletId/settings
router.patch("/:walletId/settings", requireWalletMember, validate(walletSettingsBody), async (req, res, next) => {
  const { monthStartDay, dayStartHour } = req.body;
  try {
    const { rows: [w] } = await query(
      `UPDATE wallets
       SET month_start_day = COALESCE($1, month_start_day),
           day_start_hour  = COALESCE($2, day_start_hour)
       WHERE id=$3 AND owner_id=$4 RETURNING *`,
      [monthStartDay ?? null, dayStartHour ?? null, req.walletId, req.user.id]
    );
    if (!w) return res.status(403).json({ error: "Only the owner can change settings" });
    await invalidate(`wallet:${req.walletId}:*`);
    res.json(w);
  } catch (err) { next(err); }
});

// POST /api/wallets/:walletId/members  — invite by username
router.post("/:walletId/members", requireWalletMember, validate(inviteMemberBody), async (req, res, next) => {
  const { username } = req.body;
  try {
    const { rows: [wallet] } = await query(`SELECT owner_id FROM wallets WHERE id=$1`, [req.walletId]);
    if (wallet.owner_id !== req.user.id)
      return res.status(403).json({ error: "Only the owner can invite members" });

    const { rows: [target] } = await query(
      `SELECT id, username, display_name FROM users WHERE username=$1`,
      [username.toLowerCase().trim()]
    );
    if (!target) return res.status(404).json({ error: "User not found" });

    await query(
      `INSERT INTO wallet_members (wallet_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.walletId, target.id]
    );
    await invalidate(`wallet:${req.walletId}:*`);
    res.status(201).json({ id: target.id, username: target.username, displayName: target.display_name });
  } catch (err) { next(err); }
});

// DELETE /api/wallets/:walletId/members/:userId
router.delete("/:walletId/members/:userId", requireWalletMember, async (req, res, next) => {
  const { userId } = req.params;
  try {
    const { rows: [wallet] } = await query(`SELECT owner_id FROM wallets WHERE id=$1`, [req.walletId]);
    if (wallet.owner_id === userId)
      return res.status(400).json({ error: "Cannot remove the wallet owner" });
    if (req.user.id !== wallet.owner_id && req.user.id !== userId)
      return res.status(403).json({ error: "Not authorised" });
    await query(`DELETE FROM wallet_members WHERE wallet_id=$1 AND user_id=$2`, [req.walletId, userId]);
    await invalidate(`wallet:${req.walletId}:*`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
