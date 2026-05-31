import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

export const apiUrl = "http://127.0.0.1:4568";
export const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export function importXml(
  testId: string,
  studentNumber: string,
  obtained: number,
) {
  return `
    <mcq-test-results>
      <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
        <first-name>Jane</first-name>
        <last-name>Austen</last-name>
        <student-number>${studentNumber}</student-number>
        <test-id>${testId}</test-id>
        <summary-marks available="20" obtained="${obtained}" />
      </mcq-test-result>
    </mcq-test-results>
  `;
}

export function importXmlBatch(
  testId: string,
  records: Array<{ studentNumber: string; obtained: number }>,
) {
  return `
    <mcq-test-results>
      ${records
        .map(
          ({ studentNumber, obtained }, index) => `
            <mcq-test-result scanned-on="2017-12-04T12:${String(index).padStart(2, "0")}:10+11:00">
              <first-name>Student</first-name>
              <last-name>${studentNumber}</last-name>
              <student-number>${studentNumber}</student-number>
              <test-id>${testId}</test-id>
              <summary-marks available="20" obtained="${obtained}" />
            </mcq-test-result>
          `,
        )
        .join("")}
    </mcq-test-results>
  `;
}

export async function uploadXml(
  page: Page,
  fileName: string,
  xml: string,
  expectedImported: number,
) {
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: /upload/i })).toBeEnabled();
  await page.waitForTimeout(500);

  const importResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${apiUrl}/import` &&
      response.request().method() === "POST",
  );

  await page.getByLabel(/xml file/i).setInputFiles({
    name: fileName,
    mimeType: "text/xml",
    buffer: Buffer.from(xml),
  });
  await page.getByRole("button", { name: /upload/i }).click();

  const importResponse = await importResponsePromise;
  expect(importResponse.ok()).toBe(true);
  await expect(importResponse.json()).resolves.toEqual({
    imported: expectedImported,
  });
  await expect(page.getByRole("status")).toContainText(
    new RegExp(`${expectedImported} records? imported`, "i"),
  );

  return importResponse;
}

export async function expectAggregateStat(
  page: Page,
  label: string,
  value: string,
) {
  await expect(
    page
      .getByLabel("Aggregate statistics")
      .getByText(`${label}: ${value}`, { exact: true }),
  ).toHaveText(`${label}: ${value}`);
}

export async function expectHistogramBin(page: Page, label: string) {
  await expect(
    page.getByLabel("Score distribution").getByText(label, { exact: true }),
  ).toHaveText(label);
}
