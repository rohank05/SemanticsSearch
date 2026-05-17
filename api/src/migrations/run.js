import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool } from "../db.js";

const __dir = dirname(fileURLToPath(import.meta.url));

const migrations = ["001_init.sql", "002_upgrade_vectors.sql"];

for (const file of migrations) {
  const sql = readFileSync(join(__dir, file), "utf8");
  await pool.query(sql);
  console.log(`Applied ${file}`);
}

await pool.end();
