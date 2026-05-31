import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { describe, expect, it, beforeAll } from "vitest";

import { runMigrations } from "./db/migrate";
import { app } from "./index";
import { AliceScoreAnalytics } from "./cullen-family-services/alice-score-analytics";
import { CarlisleResultsXmlParser } from "./cullen-family-services/carlisle-results-xml-parser";
import { EsmeResultsRepository } from "./cullen-family-services/esme-results-repository";
import { JasperDistributionBuilder } from "./cullen-family-services/jasper-distribution-builder";

const sampleResultsXml = readFileSync(
  new URL("../../../docs/requirements/sample_results.xml", import.meta.url),
  "utf8",
);
const resultsXmlParser = new CarlisleResultsXmlParser();
const resultsRepository = new EsmeResultsRepository();
const scoreAnalytics = new AliceScoreAnalytics();
const distributionBuilder = new JasperDistributionBuilder();

const parseResultsXml = (xml: string) => resultsXmlParser.parse(xml);
const importResults = resultsRepository.importResults.bind(resultsRepository);
const getPercentagesForTest =
  resultsRepository.getPercentagesForTest.bind(resultsRepository);
const aggregateScores = scoreAnalytics.aggregateScores.bind(scoreAnalytics);
const buildHistogram =
  distributionBuilder.buildHistogram.bind(distributionBuilder);

function xmlFor({
  testId,
  studentNumber,
  obtained,
  available = 20,
}: {
  testId: string;
  studentNumber: string;
  obtained: number;
  available?: number;
}) {
  return `
    <mcq-test-results>
      <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
        <first-name>Jane</first-name>
        <last-name>Austen</last-name>
        <student-number>${studentNumber}</student-number>
        <test-id>${testId}</test-id>
        <summary-marks available="${available}" obtained="${obtained}" />
      </mcq-test-result>
    </mcq-test-results>
  `;
}

function dedupedPercentagesFromXml(xml: string) {
  const deduped = new Map<
    string,
    { marksAvailable: number; marksObtained: number }
  >();

  for (const row of parseResultsXml(xml)) {
    const key = `${row.testId}:${row.studentNumber}`;
    const existing = deduped.get(key);

    deduped.set(key, {
      marksAvailable: Math.max(
        existing?.marksAvailable ?? 0,
        row.marksAvailable,
      ),
      marksObtained: Math.max(existing?.marksObtained ?? 0, row.marksObtained),
    });
  }

  return [...deduped.values()].map(
    (row) => (row.marksObtained * 100) / row.marksAvailable,
  );
}

beforeAll(() => {
  runMigrations();
});

describe("parseResultsXml", () => {
  it("parses valid MCQ result XML with summary marks encoded as attributes", () => {
    expect(
      parseResultsXml(`
        <mcq-test-results>
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>algebra-1</test-id>
            <summary-marks available="20" obtained="18" />
          </mcq-test-result>
        </mcq-test-results>
      `),
    ).toMatchObject([
      {
        testId: "algebra-1",
        studentNumber: "12345",
        firstName: "Ada",
        lastName: "Lovelace",
        scannedOn: "2017-12-04T12:12:10+11:00",
        marksAvailable: 20,
        marksObtained: 18,
      },
    ]);
  });

  it("ignores answer elements and extra fields in favour of summary-marks", () => {
    expect(
      parseResultsXml(`
        <mcq-test-results batch-id="scanner-7">
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>summary-wins</test-id>
            <machine-note>paper was folded</machine-note>
            <answer question="1" marks-available="10" marks-awarded="0">A</answer>
            <summary-marks available="20" obtained="18" />
          </mcq-test-result>
        </mcq-test-results>
      `)[0],
    ).toMatchObject({
      marksAvailable: 20,
      marksObtained: 18,
    });
  });

  it("rejects XML documents that are not mcq-test-results exports", () => {
    expect(() =>
      parseResultsXml(`
        <student-profile>
          <student-number>12345</student-number>
        </student-profile>
      `),
    ).toThrowError("Invalid XML format");
  });

  it("rejects the whole document when any result is missing an important field", () => {
    expect(() =>
      parseResultsXml(`
        <mcq-test-results>
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>atomic-parse</test-id>
            <summary-marks available="20" obtained="18" />
          </mcq-test-result>
          <mcq-test-result scanned-on="2017-12-04T12:13:10+11:00">
            <first-name>Grace</first-name>
            <student-number>67890</student-number>
            <test-id>atomic-parse</test-id>
            <summary-marks available="20" obtained="19" />
          </mcq-test-result>
        </mcq-test-results>
      `),
    ).toThrowError("Invalid XML format");
  });

  it.each([
    ["empty body", ""],
    ["malformed XML", "<mcq-test-results><mcq-test-result></mcq-test-results>"],
    [
      "invalid scanned-on timestamp",
      `
        <mcq-test-results>
          <mcq-test-result scanned-on="not-a-date">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>bad-scan-date</test-id>
            <summary-marks available="20" obtained="18" />
          </mcq-test-result>
        </mcq-test-results>
      `,
    ],
    [
      "non-integer marks",
      `
        <mcq-test-results>
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>bad-marks</test-id>
            <summary-marks available="20" obtained="18.5" />
          </mcq-test-result>
        </mcq-test-results>
      `,
    ],
    [
      "obtained marks greater than available marks",
      `
        <mcq-test-results>
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>impossible-marks</test-id>
            <summary-marks available="20" obtained="21" />
          </mcq-test-result>
        </mcq-test-results>
      `,
    ],
    [
      "DOCTYPE declarations",
      `
        <!DOCTYPE mcq-test-results [
          <!ENTITY surprise "not today">
        ]>
        <mcq-test-results>
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>doctype</test-id>
            <summary-marks available="20" obtained="18" />
          </mcq-test-result>
        </mcq-test-results>
      `,
    ],
  ])("rejects %s", (_caseName, xml) => {
    expect(() => parseResultsXml(xml)).toThrowError("Invalid XML format");
  });

  it("preserves leading zeroes and all 100 rows from the sample scanner export", () => {
    const rows = parseResultsXml(sampleResultsXml);

    expect(rows).toHaveLength(100);
    expect(new Set(rows.map((row) => row.testId))).toEqual(new Set(["9863"]));
    expect(rows.map((row) => row.studentNumber)).toEqual(
      expect.arrayContaining(["002299", "002349"]),
    );
  });
});

describe("aggregateScores", () => {
  it("calculates summary statistics", () => {
    const aggregate = aggregateScores([40, 60, 80]);

    expect(aggregate).toEqual({
      mean: 60,
      stddev: expect.any(Number),
      min: 40,
      max: 80,
      p25: 50,
      p50: 60,
      p75: 70,
      count: 3,
    });
    expect(aggregate.stddev).toBeCloseTo(16.32993161855452, 14);
  });

  it("calculates the expected sample fixture statistics after deduping rescans", () => {
    const aggregate = aggregateScores(
      dedupedPercentagesFromXml(sampleResultsXml),
    );

    expect(aggregate).toEqual({
      mean: expect.any(Number),
      stddev: expect.any(Number),
      min: 30,
      max: 75,
      p25: 45,
      p50: 50,
      p75: 55,
      count: 81,
    });
    expect(aggregate.mean).toBeCloseTo(50.80246913580247, 14);
    expect(aggregate.stddev).toBeCloseTo(9.921195359439231, 14);
  });
});

describe("buildHistogram", () => {
  it("places 100 percent scores in the final bin", () => {
    const histogram = buildHistogram([0, 9.9, 10, 100]);

    expect(histogram.total).toBe(4);
    expect(histogram.bins[0]).toEqual({
      lower_pct: 0,
      upper_pct: 10,
      count: 2,
    });
    expect(histogram.bins[1]).toEqual({
      lower_pct: 10,
      upper_pct: 20,
      count: 1,
    });
    expect(histogram.bins[9]).toEqual({
      lower_pct: 90,
      upper_pct: 100,
      count: 1,
    });
  });

  it("always returns ten fixed bins with zero-count bins included", () => {
    expect(buildHistogram([35, 45, 55])).toEqual({
      bins: [
        { lower_pct: 0, upper_pct: 10, count: 0 },
        { lower_pct: 10, upper_pct: 20, count: 0 },
        { lower_pct: 20, upper_pct: 30, count: 0 },
        { lower_pct: 30, upper_pct: 40, count: 1 },
        { lower_pct: 40, upper_pct: 50, count: 1 },
        { lower_pct: 50, upper_pct: 60, count: 1 },
        { lower_pct: 60, upper_pct: 70, count: 0 },
        { lower_pct: 70, upper_pct: 80, count: 0 },
        { lower_pct: 80, upper_pct: 90, count: 0 },
        { lower_pct: 90, upper_pct: 100, count: 0 },
      ],
      total: 3,
    });
  });

  it("builds the expected sample fixture histogram after deduping rescans", () => {
    expect(buildHistogram(dedupedPercentagesFromXml(sampleResultsXml))).toEqual(
      {
        bins: [
          { lower_pct: 0, upper_pct: 10, count: 0 },
          { lower_pct: 10, upper_pct: 20, count: 0 },
          { lower_pct: 20, upper_pct: 30, count: 0 },
          { lower_pct: 30, upper_pct: 40, count: 6 },
          { lower_pct: 40, upper_pct: 50, count: 28 },
          { lower_pct: 50, upper_pct: 60, count: 28 },
          { lower_pct: 60, upper_pct: 70, count: 14 },
          { lower_pct: 70, upper_pct: 80, count: 5 },
          { lower_pct: 80, upper_pct: 90, count: 0 },
          { lower_pct: 90, upper_pct: 100, count: 0 },
        ],
        total: 81,
      },
    );
  });
});

describe("importResults", () => {
  it("returns the number of accepted records, including duplicate rescans in the same document", () => {
    const testId = `same-doc-${randomUUID()}`;
    const rows = parseResultsXml(`
      <mcq-test-results>
        <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
          <first-name>Jane</first-name>
          <last-name>Austen</last-name>
          <student-number>521585128</student-number>
          <test-id>${testId}</test-id>
          <summary-marks available="20" obtained="9" />
        </mcq-test-result>
        <mcq-test-result scanned-on="2017-12-04T12:13:10+11:00">
          <first-name>Jane</first-name>
          <last-name>Austen</last-name>
          <student-number>521585128</student-number>
          <test-id>${testId}</test-id>
          <summary-marks available="20" obtained="15" />
        </mcq-test-result>
      </mcq-test-results>
    `);

    expect(importResults(rows)).toBe(2);
    expect(getPercentagesForTest(testId)).toEqual([75]);
  });

  it("keeps the maximum obtained and available marks across multiple imports", () => {
    const testId = `multi-doc-${randomUUID()}`;

    importResults(
      parseResultsXml(
        xmlFor({
          testId,
          studentNumber: "521585128",
          obtained: 12,
          available: 20,
        }),
      ),
    );
    importResults(
      parseResultsXml(
        xmlFor({
          testId,
          studentNumber: "521585128",
          obtained: 10,
          available: 25,
        }),
      ),
    );

    expect(getPercentagesForTest(testId)).toEqual([48]);
  });

  it("does not persist any row from a rejected document", () => {
    const testId = `rejected-doc-${randomUUID()}`;

    expect(() =>
      parseResultsXml(`
        <mcq-test-results>
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Jane</first-name>
            <last-name>Austen</last-name>
            <student-number>521585128</student-number>
            <test-id>${testId}</test-id>
            <summary-marks available="20" obtained="13" />
          </mcq-test-result>
          <mcq-test-result scanned-on="2017-12-04T12:13:10+11:00">
            <first-name>Bad</first-name>
            <last-name>Scan</last-name>
            <student-number></student-number>
            <test-id>${testId}</test-id>
            <summary-marks available="20" obtained="9" />
          </mcq-test-result>
        </mcq-test-results>
      `),
    ).toThrowError("Invalid XML format");

    expect(getPercentagesForTest(testId)).toEqual([]);
  });
});

describe("HTTP API contract", () => {
  it("rejects import requests without the Markr XML content type", async () => {
    const response = await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xmlFor({
        testId: `content-type-${randomUUID()}`,
        studentNumber: "521585128",
        obtained: 13,
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.stringMatching(/content-type/i),
    });
  });

  it("returns 200 and imported count for valid Markr XML", async () => {
    const response = await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "text/xml+markr" },
      body: xmlFor({
        testId: `http-import-${randomUUID()}`,
        studentNumber: "521585128",
        obtained: 13,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ imported: 1 });
  });

  it("returns 400 with the documented JSON body for malformed XML", async () => {
    const response = await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "text/xml+markr" },
      body: "<mcq-test-results>",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid XML format",
    });
  });

  it("lists tests in ascending test_id order with unique student counts and max available marks", async () => {
    const suffix = randomUUID();
    const firstTestId = `http-list-a-${suffix}`;
    const secondTestId = `http-list-b-${suffix}`;

    await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "text/xml+markr" },
      body: `
        <mcq-test-results>
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Jane</first-name>
            <last-name>Austen</last-name>
            <student-number>1001</student-number>
            <test-id>${secondTestId}</test-id>
            <summary-marks available="20" obtained="10" />
          </mcq-test-result>
          <mcq-test-result scanned-on="2017-12-04T12:13:10+11:00">
            <first-name>Jane</first-name>
            <last-name>Austen</last-name>
            <student-number>1001</student-number>
            <test-id>${firstTestId}</test-id>
            <summary-marks available="25" obtained="20" />
          </mcq-test-result>
          <mcq-test-result scanned-on="2017-12-04T12:14:10+11:00">
            <first-name>Mary</first-name>
            <last-name>Shelley</last-name>
            <student-number>1002</student-number>
            <test-id>${firstTestId}</test-id>
            <summary-marks available="20" obtained="15" />
          </mcq-test-result>
        </mcq-test-results>
      `,
    });

    const response = await app.request("/tests");
    const body = (await response.json()) as {
      tests: Array<{
        test_id: string;
        student_count: number;
        marks_available: number;
      }>;
    };

    expect(response.status).toBe(200);
    expect(
      body.tests.filter((test) =>
        [firstTestId, secondTestId].includes(test.test_id),
      ),
    ).toEqual([
      { test_id: firstTestId, student_count: 2, marks_available: 25 },
      { test_id: secondTestId, student_count: 1, marks_available: 20 },
    ]);
  });

  it("returns aggregate percentages and 404s for unknown aggregate routes", async () => {
    const testId = `http-aggregate-${randomUUID()}`;

    await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "text/xml+markr" },
      body: xmlFor({
        testId,
        studentNumber: "521585128",
        obtained: 13,
      }),
    });

    const found = await app.request(`/results/${testId}/aggregate`);
    const missing = await app.request(`/results/${testId}-missing/aggregate`);

    expect(found.status).toBe(200);
    await expect(found.json()).resolves.toEqual({
      mean: 65,
      stddev: 0,
      min: 65,
      max: 65,
      p25: 65,
      p50: 65,
      p75: 65,
      count: 1,
    });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: "Not found" });
  });

  it("returns ten histogram bins and 404s for unknown histogram routes", async () => {
    const testId = `http-histogram-${randomUUID()}`;

    await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "text/xml+markr" },
      body: xmlFor({
        testId,
        studentNumber: "521585128",
        obtained: 20,
      }),
    });

    const found = await app.request(`/results/${testId}/histogram`);
    const missing = await app.request(`/results/${testId}-missing/histogram`);

    expect(found.status).toBe(200);
    await expect(found.json()).resolves.toEqual({
      bins: [
        { lower_pct: 0, upper_pct: 10, count: 0 },
        { lower_pct: 10, upper_pct: 20, count: 0 },
        { lower_pct: 20, upper_pct: 30, count: 0 },
        { lower_pct: 30, upper_pct: 40, count: 0 },
        { lower_pct: 40, upper_pct: 50, count: 0 },
        { lower_pct: 50, upper_pct: 60, count: 0 },
        { lower_pct: 60, upper_pct: 70, count: 0 },
        { lower_pct: 70, upper_pct: 80, count: 0 },
        { lower_pct: 80, upper_pct: 90, count: 0 },
        { lower_pct: 90, upper_pct: 100, count: 1 },
      ],
      total: 1,
    });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: "Not found" });
  });
});
