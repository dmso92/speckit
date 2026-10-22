import type { ErrorRequestHandler } from "express";
import { DomainError } from "@purchase-orders/library";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof DomainError) {
    const status = error.code === "forbidden" ? 403 : error.code === "not_found" ? 404 : error.code === "conflict" ? 409 : 422;
    res.status(status).json({ code: error.code.toUpperCase(), message: error.message });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ code: "BAD_REQUEST", message: "Request body must contain valid JSON." });
    return;
  }
  res.status(500).json({ code: "INTERNAL_ERROR", message: "An unexpected server error occurred." });
};
