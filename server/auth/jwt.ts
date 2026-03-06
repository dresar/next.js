import "dotenv/config";
import jwt from "jsonwebtoken";
import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET: z.string().min(16),
});

const env = envSchema.parse(process.env);

export type JwtUser = { id: string; email: string };

export function signAccessToken(user: JwtUser) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyAccessToken(token: string): JwtUser {
  const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string; email: string };
  return { id: decoded.sub, email: decoded.email };
}

