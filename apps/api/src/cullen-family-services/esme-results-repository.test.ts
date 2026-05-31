import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

import { runMigrations } from '../db/migrate';
import { type NewTestResult } from '../db/schema';
import { EsmeResultsRepository } from './esme-results-repository';

const resultsRepository = new EsmeResultsRepository();

function resultRow({
  testId,
  studentNumber,
  obtained,
  available = 20,
}: {
  testId: string;
  studentNumber: string;
  obtained: number;
  available?: number;
}): NewTestResult {
  return {
    testId,
    studentNumber,
    firstName: 'Jane',
    lastName: 'Austen',
    scannedOn: '2017-12-04T12:12:10+11:00',
    marksAvailable: available,
    marksObtained: obtained,
    updatedAt: '2026-05-31T00:00:00.000Z',
  };
}

beforeAll(() => {
  runMigrations();
});

describe('EsmeResultsRepository', () => {
  it('returns the number of accepted records, including duplicate rescans in the same import', () => {
    const testId = `same-doc-${randomUUID()}`;

    expect(
      resultsRepository.importResults([
        resultRow({
          testId,
          studentNumber: '521585128',
          obtained: 9,
        }),
        resultRow({
          testId,
          studentNumber: '521585128',
          obtained: 15,
        }),
      ]),
    ).toBe(2);
    expect(resultsRepository.getPercentagesForTest(testId)).toEqual([75]);
  });

  it('keeps the maximum obtained and available marks across multiple imports', () => {
    const testId = `multi-doc-${randomUUID()}`;

    resultsRepository.importResults([
      resultRow({
        testId,
        studentNumber: '521585128',
        obtained: 12,
        available: 20,
      }),
    ]);
    resultsRepository.importResults([
      resultRow({
        testId,
        studentNumber: '521585128',
        obtained: 10,
        available: 25,
      }),
    ]);

    expect(resultsRepository.getPercentagesForTest(testId)).toEqual([48]);
  });

  it('lists tests in ascending test_id order with unique student counts and max available marks', () => {
    const suffix = randomUUID();
    const firstTestId = `repo-list-a-${suffix}`;
    const secondTestId = `repo-list-b-${suffix}`;

    resultsRepository.importResults([
      resultRow({
        testId: secondTestId,
        studentNumber: '1001',
        obtained: 10,
      }),
      resultRow({
        testId: firstTestId,
        studentNumber: '1001',
        obtained: 20,
        available: 25,
      }),
      resultRow({
        testId: firstTestId,
        studentNumber: '1002',
        obtained: 15,
      }),
    ]);

    expect(
      resultsRepository
        .listTests()
        .filter((test) => [firstTestId, secondTestId].includes(test.test_id)),
    ).toEqual([
      { test_id: firstTestId, student_count: 2, marks_available: 25 },
      { test_id: secondTestId, student_count: 1, marks_available: 20 },
    ]);
  });
});
