import type { RequestHandler } from "express";
import type { Actor } from "@purchase-orders/library";

export type ActorResolver = (authorization: string | undefined) => Promise<Actor | null>;

declare global {
  namespace Express {
    interface Locals {
      actor: Actor | null;
    }
  }
}

export function authentication(resolveActor: ActorResolver): RequestHandler {
  return async (req, res, next) => {
    try {
      const actor = await resolveActor(req.header("authorization"));
      if (!actor) {
        res.status(401).json({ code: "UNAUTHORIZED", message: "A valid authenticated actor is required." });
        return;
      }
      res.locals.actor = actor;
      next();
    } catch {
      console.error("Actor resolution failed.");
      res.status(503).json({ code: "SERVICE_UNAVAILABLE", message: "Authentication service is unavailable." });
    }
  };
}
