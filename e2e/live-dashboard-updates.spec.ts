import { expect, test } from "@playwright/test";

import {
  expectAggregateStat,
  expectHistogramBin,
  importXmlBatch,
  uploadXml,
} from "./support/markr-helpers";

test("detail page becomes available and receives cross-browser uploads in real time", async ({
  browser,
}) => {
  const testId = `live-${Date.now()}`;
  const viewerContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3001",
  });
  const uploaderContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3001",
  });
  const viewerPage = await viewerContext.newPage();
  const uploaderPage = await uploaderContext.newPage();
  const burstUploaderPage = await uploaderContext.newPage();

  try {
    await viewerPage.goto(`/tests/${testId}`);
    await expect(viewerPage.getByText("Test not found")).toBeVisible();
    await expect(
      viewerPage.getByText(`No imported results matched test ${testId}.`),
    ).toBeVisible();

    await uploaderPage.goto("/");
    await burstUploaderPage.goto("/");
    await uploadXml(
      uploaderPage,
      "first-results.xml",
      importXmlBatch(testId, [
        { studentNumber: "2001", obtained: 4 },
        { studentNumber: "2002", obtained: 10 },
        { studentNumber: "2003", obtained: 18 },
      ]),
      3,
    );

    await expect(
      viewerPage.getByRole("heading", { name: `Test ${testId}` }),
    ).toBeVisible({ timeout: 10_000 });
    await expectAggregateStat(viewerPage, "Count", "3");
    await expectAggregateStat(viewerPage, "Mean", "53.3333%");
    await expectAggregateStat(viewerPage, "Median", "50%");
    await expectHistogramBin(viewerPage, "90 to 100 percent: 1 student");
    await expect(
      viewerPage.getByRole("status", {
        name: /results update announcements/i,
      }),
    ).toContainText(/new results loaded/i);

    await uploadXml(
      uploaderPage,
      "second-results.xml",
      importXmlBatch(testId, [
        { studentNumber: "2004", obtained: 20 },
        { studentNumber: "2005", obtained: 16 },
      ]),
      2,
    );

    await expectAggregateStat(viewerPage, "Count", "5");
    await expectAggregateStat(viewerPage, "Mean", "68%");
    await expectAggregateStat(viewerPage, "Median", "80%");
    await expectHistogramBin(viewerPage, "90 to 100 percent: 2 students");

    await Promise.all([
      uploadXml(
        uploaderPage,
        "burst-low-results.xml",
        importXmlBatch(testId, [
          { studentNumber: "2006", obtained: 0 },
          { studentNumber: "2007", obtained: 6 },
        ]),
        2,
      ),
      uploadXml(
        burstUploaderPage,
        "burst-high-results.xml",
        importXmlBatch(testId, [
          { studentNumber: "2008", obtained: 14 },
          { studentNumber: "2009", obtained: 20 },
        ]),
        2,
      ),
    ]);

    await expectAggregateStat(viewerPage, "Count", "9");
    await expectAggregateStat(viewerPage, "Mean", "60%");
    await expectAggregateStat(viewerPage, "Median", "70%");
    await expectHistogramBin(viewerPage, "0 to 10 percent: 1 student");
    await expectHistogramBin(viewerPage, "90 to 100 percent: 3 students");
  } finally {
    await uploaderContext.close();
    await viewerContext.close();
  }
});
