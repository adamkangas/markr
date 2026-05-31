import { expect, test } from "@playwright/test";

import { importXml, uploadXml } from "./support/markr-helpers";

test("upload form posts XML with the Markr media type and shows the imported count", async ({
  page,
}) => {
  const testId = `upload-${Date.now()}`;

  await page.goto("/");
  const importResponse = await uploadXml(
    page,
    "results.xml",
    importXml(testId, "521585128", 13),
    1,
  );
  const importRequest = importResponse.request();

  expect(importRequest.headers()["content-type"]).toContain("text/xml+markr");

  await page.getByRole("link", { name: /tests/i }).click();
  await expect(
    page.getByRole("link", { name: new RegExp(testId) }),
  ).toBeVisible();
});
