"use strict";
const router = require("express").Router({ mergeParams: true });
const { query } = require("../db/postgres");
const { authenticate, requireWalletMember } = require("../middleware/auth");
const { cached, invalidate } = require("../db/redis");
const { validate, validateQuery } = require("../middleware/validate");
const { createCategoryBody, updateCategoryBody, upsertBudgetBody, budgetQuery, statsQuery } = require("../schemas");

router.use(authenticate, requireWalletMember);

// ── Categories ────────────────────────────────────────────────────────────────

// GET /api/wallets/:walletId/categories
router.get("/categories", async (req, res, next) => {
  try {
    const rows = await cached(
      `wallet:${req.walletId}:categories`, 300,
      () => query(
        `SELECT * FROM categories WHERE wallet_id=$1 ORDER BY type, sort_order, label`,
        [req.walletId]
      ).then(r => r.rows)
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/wallets/:walletId/categories
router.post("/categories", validate(createCategoryBody), async (req, res, next) => {
  const { type, label, icon, color, sortOrder } = req.body;
  try {
    const { rows: [c] } = await query(
      `INSERT INTO categories (wallet_id, type, label, icon, color, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.walletId, type, label, icon, color, sortOrder]
    );
    await invalidate(`wallet:${req.walletId}:categories`);
    res.status(201).json(c);
  } catch (err) { next(err); }
});

// PATCH /api/wallets/:walletId/categories/:id
router.patch("/categories/:id", validate(updateCategoryBody), async (req, res, next) => {
  const { label, icon, color } = req.body;
  try {
    const { rows: [c] } = await query(
      `UPDATE categories
       SET label = COALESCE($1, label),
           icon  = COALESCE($2, icon),
           color = COALESCE($3, color)
       WHERE id=$4 AND wallet_id=$5 RETURNING *`,
      [label ?? null, icon ?? null, color ?? null, req.params.id, req.walletId]
    );
    if (!c) return res.status(404).json({ error: "Category not found" });
    await invalidate(`wallet:${req.walletId}:categories`);
    res.json(c);
  } catch (err) { next(err); }
});

// DELETE /api/wallets/:walletId/categories/:id
router.delete("/categories/:id", async (req, res, next) => {
  try {
    await query(`DELETE FROM categories WHERE id=$1 AND wallet_id=$2`, [req.params.id, req.walletId]);
    await invalidate(`wallet:${req.walletId}:categories`);
    await invalidate(`wallet:${req.walletId}:budgets:*`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Budgets ───────────────────────────────────────────────────────────────────

// GET /api/wallets/:walletId/budgets?period=YYYY-MM
router.get("/budgets", validateQuery(budgetQuery), async (req, res, next) => {
  const period = req.query.period || new Date().toISOString().slice(0,7);
  try {
    const rows = await cached(
      `wallet:${req.walletId}:budgets:${period}`, 120,
      () => query(
        `SELECT b.id, b.category_id, b.amount, b.period,
                c.label, c.icon, c.color, c.type AS category_type
         FROM budgets b JOIN categories c ON c.id=b.category_id
         WHERE b.wallet_id=$1 AND b.period=$2 ORDER BY c.sort_order`,
        [req.walletId, period]
      ).then(r => r.rows)
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// PUT /api/wallets/:walletId/budgets  — upsert
router.put("/budgets", validate(upsertBudgetBody), async (req, res, next) => {
  const { categoryId, amount, period } = req.body;
  try {
    const { rows: [b] } = await query(
      `INSERT INTO budgets (wallet_id, category_id, amount, period)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (wallet_id, category_id, period)
       DO UPDATE SET amount=EXCLUDED.amount RETURNING *`,
      [req.walletId, categoryId, Math.round(amount), period]
    );
    await invalidate(`wallet:${req.walletId}:budgets:*`);
    res.json(b);
  } catch (err) { next(err); }
});

// DELETE /api/wallets/:walletId/budgets/:id
router.delete("/budgets/:id", async (req, res, next) => {
  try {
    await query(`DELETE FROM budgets WHERE id=$1 AND wallet_id=$2`, [req.params.id, req.walletId]);
    await invalidate(`wallet:${req.walletId}:budgets:*`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Stats (dashboard summary, Redis-cached 60s) ───────────────────────────────

// GET /api/wallets/:walletId/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/stats", validateQuery(statsQuery), async (req, res, next) => {
  const { from, to } = req.query;
  try {
    const rows = await cached(
      `wallet:${req.walletId}:stats:${from}:${to}`, 60,
      () => query(
        `SELECT t.type, t.category_id,
                c.label AS category_label, c.icon AS category_icon, c.color AS category_color,
                SUM(t.amount) AS total,
                COUNT(*)      AS count
         FROM transactions t
         LEFT JOIN categories c ON c.id=t.category_id
         WHERE t.wallet_id=$1 AND t.txn_date BETWEEN $2 AND $3
         GROUP BY t.type, t.category_id, c.label, c.icon, c.color
         ORDER BY total DESC`,
        [req.walletId, from, to]
      ).then(r => r.rows)
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
