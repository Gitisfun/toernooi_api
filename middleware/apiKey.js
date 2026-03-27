import crypto from "crypto";
import ApiError from "../errors/index.js";

function isUnprotectedSwaggerPath(req) {
  if (process.env.API_ENVIRONMENT !== "DEV") {
    return false;
  }
  const p = req.path ?? "";
  return p === "/api-docs.json" || p.startsWith("/api/swagger");
}

function timingSafeEqualString(a, b) {
  const bufA = Buffer.from(String(a), "utf8");
  const bufB = Buffer.from(String(b), "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Requires header `x-api-key` to match `process.env.API_KEY`.
 * Skips Swagger UI and OpenAPI JSON (only mounted when API_ENVIRONMENT=DEV).
 */
export default function apiKey(req, res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }
  if (isUnprotectedSwaggerPath(req)) {
    return next();
  }

  const expected = process.env.API_KEY;
  if (expected == null || String(expected).trim() === "") {
    return next(ApiError.internal("API_KEY is not configured"));
  }

  const provided = req.get("x-api-key");
  if (provided == null || provided === "") {
    return next(ApiError.unauthorized("Missing x-api-key header"));
  }

  if (!timingSafeEqualString(provided, expected)) {
    return next(ApiError.unauthorized("Invalid API key"));
  }

  next();
}
