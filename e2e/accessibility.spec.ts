import { expect, test } from "@playwright/test";

import { apiUrl, importXml, uploadXml } from "./support/markr-helpers";

test("upload page keeps success status and failure alert channels distinct in the browser", async ({
  page,
}) => {
  const testId = `a11y-upload-${Date.now()}`;

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Upload exam results" }),
  ).toBeVisible();
  await expect(page.getByLabel(/xml file/i)).toHaveAttribute("type", "file");
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.waitForLoadState("networkidle");

  await page.getByLabel(/xml file/i).setInputFiles({
    name: "broken.xml",
    mimeType: "text/xml",
    buffer: Buffer.from("<mcq-test-results>"),
  });
  await page.getByRole("button", { name: /upload/i }).click();

  await expect(page.getByRole("alert")).toContainText(/invalid xml format/i);
  await expect(page.getByRole("status")).toHaveCount(0);

  await uploadXml(page, "results.xml", importXml(testId, "3001", 13), 1);

  await expect(page.getByRole("status")).toContainText(/1 record imported/i);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("detail page does not announce existing results on first load and exposes freshness visibly", async ({
  page,
  request,
}) => {
  const testId = `a11y-detail-${Date.now()}`;

  const importResponse = await request.post(`${apiUrl}/import`, {
    headers: { "Content-Type": "text/xml+markr" },
    data: importXml(testId, "3002", 13),
  });

  await expect(importResponse).toBeOK();

  await page.goto(`/tests/${testId}`);

  await expect(
    page.getByRole("heading", { name: `Test ${testId}` }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: /results update announcements/i }),
  ).toHaveText("");
  await expect(page.getByText(/^Last refreshed /)).toBeVisible();
});

test("histogram bars transition subtly when reduced motion is not requested", async ({
  page,
  request,
}) => {
  const testId = `a11y-motion-default-${Date.now()}`;

  const importResponse = await request.post(`${apiUrl}/import`, {
    headers: { "Content-Type": "text/xml+markr" },
    data: importXml(testId, "3004", 13),
  });

  await expect(importResponse).toBeOK();
  await page.goto(`/tests/${testId}`);
  await expect(
    page.getByRole("heading", { name: `Test ${testId}` }),
  ).toBeVisible();

  const motionStyles = await page
    .getByTestId("histogram-bar")
    .evaluateAll((bars) =>
      bars.map((bar) => window.getComputedStyle(bar).transitionDuration),
    );

  expect(motionStyles).toHaveLength(10);
  for (const transitionDuration of motionStyles) {
    expect(transitionDuration).toBe("0.5s");
  }
});

test.describe("when reduced motion is requested", () => {
  test.use({ reducedMotion: "reduce" });

  test("histogram bars have instantaneous transition and animation styles", async ({
    page,
    request,
  }) => {
    const testId = `a11y-motion-${Date.now()}`;

    const importResponse = await request.post(`${apiUrl}/import`, {
      headers: { "Content-Type": "text/xml+markr" },
      data: importXml(testId, "3003", 13),
    });

    await expect(importResponse).toBeOK();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/tests/${testId}`);
    await expect(
      page.getByRole("heading", { name: `Test ${testId}` }),
    ).toBeVisible();
    await expect(
      page.evaluate(
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).resolves.toBe(true);

    const motionStyles = await page
      .getByTestId("histogram-bar")
      .evaluateAll((bars) =>
        bars.map((bar) => {
          const styles = window.getComputedStyle(bar);

          return {
            animationDuration: styles.animationDuration,
            transitionDuration: styles.transitionDuration,
          };
        }),
      );

    expect(motionStyles).toHaveLength(10);
    for (const styles of motionStyles) {
      expect(styles.animationDuration).toBe("0s");
      expect(styles.transitionDuration).toBe("0s");
    }
  });
});
