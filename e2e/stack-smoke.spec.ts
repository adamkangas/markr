import { expect, test } from "@playwright/test";

const apiUrl = "http://127.0.0.1:4568";

test("serves the web app and lets the browser reach the API", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Upload exam results" }),
  ).toBeVisible();

  const health = await page.evaluate(async (url) => {
    const response = await fetch(`${url}/health`);

    return {
      ok: response.ok,
      body: (await response.json()) as unknown,
    };
  }, apiUrl);

  expect(health).toEqual({
    ok: true,
    body: {
      app: "markr",
      service: "api",
      message: "ok",
    },
  });
});

test("can import exam XML through the API used by the E2E stack", async ({
  request,
}) => {
  const importResponse = await request.post(`${apiUrl}/import`, {
    headers: { "Content-Type": "text/xml+markr" },
    data: `
      <mcq-test-results>
        <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
          <first-name>Jane</first-name>
          <last-name>Austen</last-name>
          <student-number>521585128</student-number>
          <test-id>e2e-api-import</test-id>
          <summary-marks available="20" obtained="13" />
        </mcq-test-result>
      </mcq-test-results>
    `,
  });

  await expect(importResponse).toBeOK();
  await expect(importResponse.json()).resolves.toEqual({ imported: 1 });

  const aggregateResponse = await request.get(
    `${apiUrl}/results/e2e-api-import/aggregate`,
  );

  await expect(aggregateResponse).toBeOK();
  await expect(aggregateResponse.json()).resolves.toEqual(
    expect.objectContaining({
      count: 1,
      mean: 65,
      min: 65,
      max: 65,
    }),
  );
});
