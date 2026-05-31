import { expect, test } from "@playwright/test";

import { apiUrl, importXml, importXmlBatch } from "./support/markr-helpers";

test("backend endpoints return documented status codes and JSON bodies", async ({
  request,
}) => {
  const testId = `api-contract-${Date.now()}`;
  const rescanTestId = `api-rescan-${Date.now()}`;
  const atomicRejectTestId = `api-atomic-${Date.now()}`;

  const wrongContentType = await request.post(`${apiUrl}/import`, {
    headers: { "Content-Type": "application/xml" },
    data: importXml(testId, "1001", 10),
  });

  expect(wrongContentType.status()).toBe(400);
  await expect(wrongContentType.json()).resolves.toEqual({
    error: expect.stringMatching(/content-type/i),
  });

  const malformed = await request.post(`${apiUrl}/import`, {
    headers: { "Content-Type": "text/xml+markr" },
    data: "<mcq-test-results>",
  });

  expect(malformed.status()).toBe(400);
  await expect(malformed.json()).resolves.toEqual({
    error: "Invalid XML format",
  });

  const sameRequestRescans = await request.post(`${apiUrl}/import`, {
    headers: { "Content-Type": "text/xml+markr" },
    data: `
      <mcq-test-results>
        <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
          <first-name>Jane</first-name>
          <last-name>Austen</last-name>
          <student-number>1001</student-number>
          <test-id>${rescanTestId}</test-id>
          <summary-marks available="20" obtained="9" />
        </mcq-test-result>
        <mcq-test-result scanned-on="2017-12-04T12:13:10+11:00">
          <first-name>Jane</first-name>
          <last-name>Austen</last-name>
          <student-number>1001</student-number>
          <test-id>${rescanTestId}</test-id>
          <summary-marks available="18" obtained="15" />
        </mcq-test-result>
      </mcq-test-results>
    `,
  });
  const laterRescan = await request.post(`${apiUrl}/import`, {
    headers: { "Content-Type": "text/xml+markr" },
    data: importXmlBatch(rescanTestId, [
      { studentNumber: "1001", obtained: 10 },
    ]).replace('available="20"', 'available="25"'),
  });
  const rescanAggregate = await request.get(
    `${apiUrl}/results/${rescanTestId}/aggregate`,
  );
  const rescanTests = await request.get(`${apiUrl}/tests`);

  await expect(sameRequestRescans).toBeOK();
  await expect(sameRequestRescans.json()).resolves.toEqual({ imported: 2 });
  await expect(laterRescan).toBeOK();
  await expect(laterRescan.json()).resolves.toEqual({ imported: 1 });
  await expect(rescanAggregate.json()).resolves.toEqual(
    expect.objectContaining({ count: 1, mean: 60, min: 60, max: 60 }),
  );
  await expect(rescanTests.json()).resolves.toEqual(
    expect.objectContaining({
      tests: expect.arrayContaining([
        {
          test_id: rescanTestId,
          student_count: 1,
          marks_available: 25,
        },
      ]),
    }),
  );

  const mixedInvalid = await request.post(`${apiUrl}/import`, {
    headers: { "Content-Type": "text/xml+markr" },
    data: `
      <mcq-test-results>
        <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
          <first-name>Jane</first-name>
          <last-name>Austen</last-name>
          <student-number>1001</student-number>
          <test-id>${atomicRejectTestId}</test-id>
          <summary-marks available="20" obtained="13" />
        </mcq-test-result>
        <mcq-test-result scanned-on="2017-12-04T12:13:10+11:00">
          <first-name>Broken</first-name>
          <last-name>Scanner</last-name>
          <student-number></student-number>
          <test-id>${atomicRejectTestId}</test-id>
          <summary-marks available="20" obtained="9" />
        </mcq-test-result>
      </mcq-test-results>
    `,
  });
  const rejectedAggregate = await request.get(
    `${apiUrl}/results/${atomicRejectTestId}/aggregate`,
  );
  const rejectedTests = await request.get(`${apiUrl}/tests`);

  expect(mixedInvalid.status()).toBe(400);
  await expect(mixedInvalid.json()).resolves.toEqual({
    error: "Invalid XML format",
  });
  expect(rejectedAggregate.status()).toBe(404);
  await expect(rejectedTests.json()).resolves.toEqual(
    expect.objectContaining({
      tests: expect.not.arrayContaining([
        expect.objectContaining({ test_id: atomicRejectTestId }),
      ]),
    }),
  );

  const aggregateMissing = await request.get(
    `${apiUrl}/results/${testId}-missing/aggregate`,
  );
  const histogramMissing = await request.get(
    `${apiUrl}/results/${testId}-missing/histogram`,
  );

  expect(aggregateMissing.status()).toBe(404);
  await expect(aggregateMissing.json()).resolves.toEqual({
    error: "Not found",
  });
  expect(histogramMissing.status()).toBe(404);
  await expect(histogramMissing.json()).resolves.toEqual({
    error: "Not found",
  });
});
