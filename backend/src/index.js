"use strict";
require("dotenv").config();

const express     = require("express");
const helmet      = require("helmet");
const cors        = require("cors");
const compression = require("compression");
const morgan      = require("morgan");
const session     = require("express-session");
const RedisStore  = require("connect-redis").default;

const { redis }         = require("./db/redis");
const { pool }          = require("./db/postgres");
const { apiLimiter, authLimiter } = require("./middleware/rateLimit");

const authRoutes    = require("./routes/auth");
const walletRoutes  = require("./routes/wallets");
const txnRoutes     = require("./routes/transactions");
const budgetRoutes  = require("./routes/budgets");

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

app.set("trust proxy", 1); // required behind nginx

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost")
  .split(",").map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));

// ── Parsing + compression ─────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ── Session (Redis-backed, used alongside JWT) ────────────────────────────────
app.use(session({
  store: new RedisStore({ client: redis }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000,
    sameSite: "strict",
  },
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter);
app.use("/api",      apiLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    await redis.ping();
    res.json({ status: "ok", uptime: process.uptime(), ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "degraded", error: err.message });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",    authRoutes);
app.use("/api/wallets", walletRoutes);

// Nested wallet routes (mergeParams handled inside each router)
app.use("/api/wallets/:walletId/transactions", txnRoutes);
app.use("/api/wallets/:walletId",              budgetRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const isProd  = process.env.NODE_ENV === "production";
  if (status >= 500) console.error("[error]", err);
  res.status(status).json({
    error: isProd && status >= 500 ? "Internal server error" : err.message,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[walletly] API ready on :${PORT} (${process.env.NODE_ENV || "development"})`);
});

module.exports = app;
