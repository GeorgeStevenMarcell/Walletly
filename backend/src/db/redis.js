"use strict";
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on("connect",      () => console.log("[redis] connected"));
redis.on("error",        (e) => console.error("[redis] error:", e.message));
redis.on("reconnecting", () => console.warn("[redis] reconnecting…"));

/**
 * Cache-aside pattern.
 * Returns cached value if present; otherwise calls loader(), caches + returns result.
 * If Redis is unavailable, falls back to calling loader() directly.
 */
async function cached(key, ttlSeconds, loader) {
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit);
  } catch (e) {
    console.warn("[redis] cache read failed, falling back to DB:", e.message);
  }

  const value = await loader();

  if (value != null) {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (e) {
      console.warn("[redis] cache write failed:", e.message);
    }
  }

  return value;
}

/**
 * Delete all keys matching a glob pattern using SCAN (non-blocking).
 * Unlike redis.keys(), SCAN iterates incrementally and won't block the server.
 */
async function invalidate(pattern) {
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  } catch (e) {
    console.warn("[redis] invalidate failed:", e.message);
  }
}

module.exports = { redis, cached, invalidate };
