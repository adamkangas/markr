import { randomUUID } from "node:crypto";
import {
  testResultsUpdatedEventName,
  testResultsUpdatedEventSchema,
} from "@markr/contracts";
import { beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "./db/migrate";
import { app } from "./index";

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

beforeAll(() => {
  runMigrations();
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

  it("deduplicates rescans through HTTP imports while keeping maximum marks", async () => {
    const testId = `http-rescan-${randomUUID()}`;

    const sameRequest = await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "text/xml+markr" },
      body: `
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
            <summary-marks available="18" obtained="15" />
          </mcq-test-result>
        </mcq-test-results>
      `,
    });

    const laterRescan = await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "text/xml+markr" },
      body: xmlFor({
        testId,
        studentNumber: "521585128",
        obtained: 10,
        available: 25,
      }),
    });
    const aggregate = await app.request(`/results/${testId}/aggregate`);
    const tests = await app.request("/tests");
    const testsBody = (await tests.json()) as {
      tests: Array<{
        test_id: string;
        student_count: number;
        marks_available: number;
      }>;
    };

    expect(sameRequest.status).toBe(200);
    await expect(sameRequest.json()).resolves.toEqual({ imported: 2 });
    expect(laterRescan.status).toBe(200);
    await expect(laterRescan.json()).resolves.toEqual({ imported: 1 });
    expect(aggregate.status).toBe(200);
    await expect(aggregate.json()).resolves.toEqual({
      mean: 60,
      stddev: 0,
      min: 60,
      max: 60,
      p25: 60,
      p50: 60,
      p75: 60,
      count: 1,
    });
    expect(testsBody.tests.find((test) => test.test_id === testId)).toEqual({
      test_id: testId,
      student_count: 1,
      marks_available: 25,
    });
  });

  it("streams a results-updated SSE event when data is imported for the subscribed test", async () => {
    const testId = `http-events-${randomUUID()}`;
    const response = await app.request(`/results/${testId}/events`);
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(reader).toBeDefined();

    const connected = await reader?.read();
    expect(decoder.decode(connected?.value)).toContain(": connected");

    const nextEvent = reader?.read();

    await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "text/xml+markr" },
      body: xmlFor({
        testId,
        studentNumber: "521585128",
        obtained: 13,
      }),
    });

    const event = decoder.decode((await nextEvent)?.value);
    expect(
      testResultsUpdatedEventSchema.parse({
        event: event.match(/^event: (.*)$/m)?.[1],
        data: JSON.parse(event.match(/^data: (.*)$/m)?.[1] ?? ""),
      }),
    ).toEqual({
      event: testResultsUpdatedEventName,
      data: { testId },
    });

    await reader?.cancel();
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

  it("rejects a mixed invalid document without persisting its valid rows", async () => {
    const testId = `http-atomic-reject-${randomUUID()}`;

    const response = await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "text/xml+markr" },
      body: `
        <mcq-test-results>
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Jane</first-name>
            <last-name>Austen</last-name>
            <student-number>521585128</student-number>
            <test-id>${testId}</test-id>
            <summary-marks available="20" obtained="13" />
          </mcq-test-result>
          <mcq-test-result scanned-on="2017-12-04T12:13:10+11:00">
            <first-name>Broken</first-name>
            <last-name>Scanner</last-name>
            <student-number></student-number>
            <test-id>${testId}</test-id>
            <summary-marks available="20" obtained="9" />
          </mcq-test-result>
        </mcq-test-results>
      `,
    });
    const aggregate = await app.request(`/results/${testId}/aggregate`);
    const tests = await app.request("/tests");
    const testsBody = (await tests.json()) as {
      tests: Array<{ test_id: string }>;
    };

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid XML format",
    });
    expect(aggregate.status).toBe(404);
    await expect(aggregate.json()).resolves.toEqual({ error: "Not found" });
    expect(testsBody.tests).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ test_id: testId })]),
    );
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
