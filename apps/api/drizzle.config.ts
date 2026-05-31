import { defineConfig } from "drizzle-kit";

import { databasePath } from "./src/db/database-path";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: databasePath,
  },
});
