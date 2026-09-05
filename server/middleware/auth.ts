import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type JwtUser } from "../auth/jwt.js";

export type AuthedRequest = Request & { auth?: JwtUser };

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    req.auth = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "Akses ditolak. Role tidak memiliki izin." });
    }
    return next();
  };
}
