"use strict";
const { z } = require("zod");

// ── Reusable primitives ─────────────────────────────────────────────────────

const username = z
  .string({ required_error: "username is required" })
  .trim()
  .toLowerCase()
  .min(1, "username is required")
  .max(50, "username must be at most 50 characters")
  .regex(/^[a-z0-9_.-]+$/, "username may only contain letters, numbers, dots, dashes, underscores");

const password = z
  .string({ required_error: "password is required" })
  .min(6, "Password must be at least 6 characters")
  .max(128, "Password must be at most 128 characters");

const displayName = z
  .string({ required_error: "displayName is required" })
  .trim()
  .min(1, "displayName is required")
  .max(100, "displayName must be at most 100 characters");

const walletName = z
  .string({ required_error: "name is required" })
  .trim()
  .min(1, "name is required")
  .max(100, "name must be at most 100 characters");

const txnType = z.enum(["expense", "income"], {
  errorMap: () => ({ message: "type must be expense or income" }),
});

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format");

const periodStr = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "period must be in YYYY-MM format");

const uuidStr = z.string().uuid("invalid id format");

// ── Auth ────────────────────────────────────────────────────────────────────

exports.registerBody = z.object({
  username,
  password,
  displayName,
});

exports.loginBody = z.object({
  username: z.string({ required_error: "username is required" }).min(1, "username is required"),
  password: z.string({ required_error: "password is required" }).min(1, "password is required"),
});

// ── Wallets ─────────────────────────────────────────────────────────────────

exports.createWalletBody = z.object({ name: walletName });
exports.renameWalletBody = z.object({ name: walletName });

exports.walletSettingsBody = z.object({
  monthStartDay: z.coerce.number().int().min(1).max(28).optional(),
  dayStartHour: z.coerce.number().int().min(0).max(23).optional(),
});

exports.excludeCombinedBody = z.object({
  exclude: z.boolean({ required_error: "exclude is required" }),
});

exports.inviteMemberBody = z.object({
  username: z
    .string({ required_error: "username is required" })
    .trim()
    .toLowerCase()
    .min(1, "username is required")
    .max(50),
});

// ── Transactions ────────────────────────────────────────────────────────────

exports.createTxnBody = z.object({
  type: txnType,
  amount: z.coerce.number().positive("amount must be positive"),
  categoryId: z.string().uuid().nullable().optional(),
  note: z.string().max(500, "note must be at most 500 characters").nullable().optional(),
  txnDate: dateStr,
});

exports.updateTxnBody = z.object({
  amount: z.coerce.number().positive("amount must be positive").optional(),
  categoryId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  txnDate: dateStr.optional(),
});

exports.txnQuery = z.object({
  from: dateStr.optional(),
  to: dateStr.optional(),
  type: txnType.optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Categories ──────────────────────────────────────────────────────────────

exports.createCategoryBody = z.object({
  type: txnType,
  label: z.string().trim().min(1, "label is required").max(50, "label must be at most 50 characters"),
  icon: z.string().max(10).default("\u{1F4E6}"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "color must be a hex code like #ff0000")
    .default("#6b7280"),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

// ── Budgets ─────────────────────────────────────────────────────────────────

exports.upsertBudgetBody = z.object({
  categoryId: z.string().uuid("invalid categoryId"),
  amount: z.coerce.number().min(0, "amount cannot be negative"),
  period: periodStr,
});

exports.budgetQuery = z.object({
  period: periodStr.optional(),
});

// ── Stats ───────────────────────────────────────────────────────────────────

exports.statsQuery = z.object({
  from: dateStr,
  to: dateStr,
});
