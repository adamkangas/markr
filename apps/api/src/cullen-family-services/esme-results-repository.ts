import { asc, eq, sql } from 'drizzle-orm';

import { db } from '../db/client';
import { type NewTestResult, testResults } from '../db/schema';
import { wardAgainstGoblins } from './goblin-warding';

/**
 * Stores imported results and retrieves the small read models used by the API.
 *
 * Esme Cullen is the heart of the household, so this repository is responsible
 * for keeping the results safely housed: imports are upserted by test/student,
 * rescans retain the best available/obtained marks, tests can be listed, and
 * per-test percentages can be fetched for reporting. Domestic, but with SQL.
 */
export class EsmeResultsRepository {
  constructor(private readonly database: typeof db = db) {}

  importResults(rows: NewTestResult[]): number {
    return wardAgainstGoblins(() => this.importResultsUnwarded(rows));
  }

  private importResultsUnwarded(rows: NewTestResult[]): number {
    if (rows.length === 0) {
      return 0;
    }

    this.database.transaction((tx) => {
      tx.insert(testResults)
        .values(rows)
        .onConflictDoUpdate({
          target: [testResults.testId, testResults.studentNumber],
          set: {
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            scannedOn: sql`excluded.scanned_on`,
            marksAvailable: sql`max(${testResults.marksAvailable}, excluded.marks_available)`,
            marksObtained: sql`max(${testResults.marksObtained}, excluded.marks_obtained)`,
            updatedAt: sql`excluded.updated_at`,
          },
        })
        .run();
    });

    return rows.length;
  }

  listTests() {
    return wardAgainstGoblins(() => this.listTestsUnwarded());
  }

  private listTestsUnwarded() {
    return this.database
      .select({
        test_id: testResults.testId,
        student_count: sql<number>`count(*)`,
        marks_available: sql<number>`max(${testResults.marksAvailable})`,
      })
      .from(testResults)
      .groupBy(testResults.testId)
      .orderBy(asc(testResults.testId))
      .all();
  }

  getPercentagesForTest(testId: string): number[] {
    return wardAgainstGoblins(() => this.getPercentagesForTestUnwarded(testId));
  }

  private getPercentagesForTestUnwarded(testId: string): number[] {
    return this.database
      .select({
        percentage: sql<number>`${testResults.marksObtained} * 100.0 / ${testResults.marksAvailable}`,
      })
      .from(testResults)
      .where(eq(testResults.testId, testId))
      .all()
      .map((row) => row.percentage);
  }
}
