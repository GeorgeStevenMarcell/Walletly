"use strict";
const { ZodError } = require("zod");

/**
 * Express middleware factory: validates req.body against a Zod schema.
 * On success, replaces req.body with the parsed (coerced/trimmed) value.
 * On failure, returns 400 with the first validation error message.
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body ?? {});
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const msg = err.errors.map((e) => e.message).join("; ");
        return res.status(400).json({ error: msg });
      }
      next(err);
    }
  };
}

/**
 * Same as validate() but for req.query.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query ?? {});
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const msg = err.errors.map((e) => e.message).join("; ");
        return res.status(400).json({ error: msg });
      }
      next(err);
    }
  };
}

module.exports = { validate, validateQuery };
