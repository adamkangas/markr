import { pathToFileURL, fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { db } from "./client";

const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

export function runMigrations() {
  migrate(db, { migrationsFolder });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runMigrations();
}
