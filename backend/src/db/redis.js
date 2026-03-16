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
 * @param {string}   key
 * @param {number}   ttlSeconds
 * @param {Function} loader  async () => value
 */
async function cached(key, ttlSeconds, loader) {
  const hit = await redis.get(key);
  if (hit !== null) return JSON.parse(hit);
  const value = await loader();
  if (value != null) await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  return value;
}

/** Delete all keys matching a glob pattern */
async function invalidate(pattern) {
  const keys = await redis.keys(pattern);
  if (keys.length) await redis.del(...keys);
}

module.exports = { redis, cached, invalidate };
