import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const testResults = sqliteTable(
  "test_results",
  {
    testId: text("test_id").notNull(),
    studentNumber: text("student_number").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    scannedOn: text("scanned_on").notNull(),
    marksAvailable: integer("marks_available").notNull(),
    marksObtained: integer("marks_obtained").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.testId, table.studentNumber] }),
    index("test_results_test_id_idx").on(table.testId),
  ],
);

export type TestResult = typeof testResults.$inferSelect;
export type NewTestResult = typeof testResults.$inferInsert;
