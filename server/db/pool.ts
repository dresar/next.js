import "dotenv/config";
import { Pool } from "pg";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional().default(""),
});

const env = envSchema.parse(process.env);

export const pool = new Pool({
  connectionString: env.DATABASE_URL || "postgresql://neondb_owner:npg_urPNYewy16kC@ep-falling-resonance-a1ecw5fv-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  max: 10,
});

