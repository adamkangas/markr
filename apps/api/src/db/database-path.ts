import { fileURLToPath } from "node:url";

export const defaultDatabasePath = fileURLToPath(
  new URL("../../../../data/markr.db", import.meta.url),
);

export const databasePath = process.env.DATABASE_PATH ?? defaultDatabasePath;
