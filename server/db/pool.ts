import "dotenv/config";
import { Pool } from "pg";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional().default(""),
});

const env = envSchema.parse(process.env);

export const pool = new Pool({
  connectionString: env.DATABASE_URL || "postgresql://user:password@localhost:5432/dbname",
  max: 10,
});

