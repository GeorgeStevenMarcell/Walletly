"use strict";

/**
 * Validate that all required environment variables are set.
 * Call this before anything else boots. Fails fast with a clear message.
 */
function validateEnv() {
  const required = [
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_SECRET",
    "SESSION_SECRET",
  ];

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[walletly] FATAL: missing required env vars: ${missing.join(", ")}`);
    console.error("[walletly] Copy .env.example to .env and fill in the values.");
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.warn("[walletly] WARNING: JWT_SECRET is shorter than 32 chars — use a stronger secret in production");
  }
}

/**
 * Register graceful shutdown handlers.
 * On SIGTERM/SIGINT: stop accepting new connections, drain in-flight requests,
 * close database pool and Redis, then exit.
 */
function setupGracefulShutdown(server, pool, redis) {
  let shuttingDown = false;

  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[walletly] ${signal} received — shutting down gracefully…`);

    // Stop accepting new connections, let in-flight ones finish (10s timeout)
    server.close(() => {
      console.log("[walletly] HTTP server closed");
    });

    setTimeout(async () => {
      try {
        await pool.end();
        console.log("[walletly] PostgreSQL pool closed");
      } catch (e) {
        console.error("[walletly] Error closing PostgreSQL:", e.message);
      }

      try {
        redis.disconnect();
        console.log("[walletly] Redis disconnected");
      } catch (e) {
        console.error("[walletly] Error closing Redis:", e.message);
      }

      process.exit(0);
    }, 100); // brief delay so server.close callback fires first

    // Force exit after 10 seconds if drain doesn't complete
    setTimeout(() => {
      console.error("[walletly] Forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

module.exports = { validateEnv, setupGracefulShutdown };
