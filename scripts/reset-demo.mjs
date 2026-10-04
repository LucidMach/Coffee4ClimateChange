import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { seedTestListings } from "../src/lib/fixtures.ts";
import { listingInputSchema } from "../src/lib/domain.ts";

if (process.env.VERCEL || process.env.NILE_STORAGE === "supabase") {
  throw new Error("This reset command is only for the local SQLite demo.");
}

// Validate the scenario before opening or changing the current workspace.
const listings = seedTestListings();
for (const listing of listings) listingInputSchema.parse(listing);
const path = resolve(process.env.NILE_DB_PATH || ".nile/demo.sqlite");
const existed = existsSync(path);
mkdirSync(dirname(path), { recursive: true });
const db = new DatabaseSync(path);
let backupPath = null;
try {
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (existed) {
    const backupDir = join(dirname(path), "backups");
    mkdirSync(backupDir, { recursive: true });
    backupPath = join(
      backupDir,
      `before-test-reset-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
    );
    // VACUUM INTO creates a consistent SQLite snapshot, including committed WAL
    // contents. Copying only demo.sqlite while the server is running would miss them.
    db.prepare("VACUUM INTO ?").run(backupPath);
    const snapshot = new DatabaseSync(backupPath, { readOnly: true });
    try {
      if (
        snapshot.prepare("PRAGMA integrity_check").get().integrity_check !==
        "ok"
      ) {
        throw new Error(
          "Backup integrity check failed; original workspace was not changed.",
        );
      }
    } finally {
      snapshot.close();
    }
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(
      "CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS transfers (id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES listings(id), data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS ai_calls (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);",
    );
    // Clear old test handovers before replacing their listings. Keep the AI call
    // ledger so a workspace reset cannot bypass the daily API request limit.
    db.exec("DELETE FROM transfers; DELETE FROM listings;");
    const insert = db.prepare("INSERT INTO listings(id, data) VALUES (?, ?)");
    for (const listing of listings)
      insert.run(listing.id, JSON.stringify(listing));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  console.log(
    JSON.stringify(
      {
        database: path,
        backup: backupPath,
        suppliers: new Set(listings.map((l) => l.supplierId)).size,
        listings: listings.length,
        availableKg: listings.reduce((sum, l) => sum + l.quantityKg, 0),
        transfers: 0,
        evidence: "Fictional test data; no recorded reuse or climate savings.",
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
