import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./pool";

async function main() {
  const migrationsDir = path.resolve(process.cwd(), "db", "migrations");
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log("No migrations found in", migrationsDir);
    return;
  }

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = await readFile(fullPath, "utf8");
    console.log("Applying", file);
    await pool.query(sql);
  }

  console.log("Migrations applied:", files.length);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

