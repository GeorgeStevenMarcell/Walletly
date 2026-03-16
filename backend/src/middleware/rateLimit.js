"use strict";
const rateLimit  = require("express-rate-limit");
const RedisStore = require("rate-limit-redis");
const { redis }  = require("../db/redis");

const store = new RedisStore({
  sendCommand: (...args) => redis.call(...args),
});

/** General API limiter: 200 req / 15 min / IP */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store,
  message: { error: "Too many requests, please slow down." },
});

/** Strict limiter for auth routes: 10 req / 15 min / IP */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store,
  message: { error: "Too many login attempts, please try again later." },
});

module.exports = { apiLimiter, authLimiter };
