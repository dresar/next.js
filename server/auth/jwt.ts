import "dotenv/config";
import jwt from "jsonwebtoken";
import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET: z.string().min(1).optional().default("9c72e5b84f6f3f91d20f9c4a5f1c9e7b5c8d3f1a"),
});

const env = envSchema.parse(process.env);

export type JwtUser = { id: string; email: string; role: string };

export function signAccessToken(user: JwtUser) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyAccessToken(token: string): JwtUser {
  const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string; email: string; role?: string };
  return { id: decoded.sub, email: decoded.email, role: decoded.role ?? "petani" };
}
