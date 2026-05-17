import cron from "node-cron";
import { pool } from "../db.js";

export function startCleanupJob() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const { rowCount: docs } = await pool.query(
        "DELETE FROM documents WHERE expires_at < NOW()"
      );
      const { rowCount: guests } = await pool.query(
        "DELETE FROM guest_sessions WHERE expires_at < NOW()"
      );
      const { rowCount: tokens } = await pool.query(
        "DELETE FROM refresh_tokens WHERE expires_at < NOW()"
      );
      if (docs + guests + tokens > 0) {
        console.log(`Cleanup: removed ${docs} docs, ${guests} guest sessions, ${tokens} refresh tokens`);
      }
    } catch (err) {
      console.error("Cleanup job error:", err);
    }
  });
}
