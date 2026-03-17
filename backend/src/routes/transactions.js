"use strict";
const router = require("express").Router({ mergeParams: true });
const { query } = require("../db/postgres");
const { authenticate, requireWalletMember } = require("../middleware/auth");
const { invalidate } = require("../db/redis");
const { validate, validateQuery } = require("../middleware/validate");
const { createTxnBody, updateTxnBody, txnQuery } = require("../schemas");

router.use(authenticate, requireWalletMember);

// GET /api/wallets/:walletId/transactions?from=&to=&type=&limit=&offset=
router.get("/", validateQuery(txnQuery), async (req, res, next) => {
  const { from, to, type, limit, offset } = req.query;
  const conditions = ["t.wallet_id=$1"];
  const params = [req.walletId];
  let p = 2;
  if (from) { conditions.push(`t.txn_date >= $${p++}`); params.push(from); }
  if (to)   { conditions.push(`t.txn_date <= $${p++}`); params.push(to); }
  if (type) { conditions.push(`t.type = $${p++}`);      params.push(type); }
  const where = conditions.join(" AND ");
  try {
    const [{ rows }, { rows: [{ total }] }] = await Promise.all([
      query(
        `SELECT t.id, t.type, t.amount, t.note, t.txn_date,
                t.created_at, t.updated_at,
                u.username AS added_by,
                t.category_id,
                c.label AS category_label,
                c.icon  AS category_icon,
                c.color AS category_color
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN users u ON u.id = t.user_id
         WHERE ${where}
         ORDER BY t.txn_date DESC, t.created_at DESC
         LIMIT $${p} OFFSET $${p+1}`,
        [...params, limit, offset]
      ),
      query(
        `SELECT COUNT(*)::int AS total FROM transactions t WHERE ${where}`,
        params
      ),
    ]);
    res.json({ data: rows, total, hasMore: offset + rows.length < total });
  } catch (err) { next(err); }
});

// POST /api/wallets/:walletId/transactions
router.post("/", validate(createTxnBody), async (req, res, next) => {
  const { type, amount, categoryId, note, txnDate } = req.body;
  try {
    const { rows: [t] } = await query(
      `INSERT INTO transactions (wallet_id, user_id, category_id, type, amount, note, txn_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.walletId, req.user.id, categoryId || null, type, Math.round(amount), note || null, txnDate]
    );
    await invalidate(`wallet:${req.walletId}:stats:*`);
    res.status(201).json(t);
  } catch (err) { next(err); }
});

// PATCH /api/wallets/:walletId/transactions/:id
router.patch("/:id", validate(updateTxnBody), async (req, res, next) => {
  const { amount, categoryId, note, txnDate } = req.body;
  try {
    const { rows: [t] } = await query(
      `UPDATE transactions
       SET amount      = COALESCE($1, amount),
           category_id = COALESCE($2, category_id),
           note        = COALESCE($3, note),
           txn_date    = COALESCE($4, txn_date)
       WHERE id=$5 AND wallet_id=$6 RETURNING *`,
      [amount ? Math.round(+amount) : null, categoryId || null, note ?? null, txnDate || null,
       req.params.id, req.walletId]
    );
    if (!t) return res.status(404).json({ error: "Transaction not found" });
    await invalidate(`wallet:${req.walletId}:stats:*`);
    res.json(t);
  } catch (err) { next(err); }
});

// DELETE /api/wallets/:walletId/transactions/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM transactions WHERE id=$1 AND wallet_id=$2`,
      [req.params.id, req.walletId]
    );
    if (!rowCount) return res.status(404).json({ error: "Transaction not found" });
    await invalidate(`wallet:${req.walletId}:stats:*`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
