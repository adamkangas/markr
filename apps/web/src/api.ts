import {
  aggregateResponseSchema,
  apiErrorSchema,
  histogramResponseSchema,
  importResponseSchema,
  testsResponseSchema,
} from "@markr/contracts";

const browserApiBaseUrl =
  import.meta.env.VITE_API_BROWSER_BASE_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:4567";

const serverApiBaseUrl =
  import.meta.env.VITE_API_SERVER_BASE_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  browserApiBaseUrl;

export const apiBaseUrl = import.meta.env.SSR
  ? serverApiBaseUrl
  : browserApiBaseUrl;

export async function apiJson(response: Response): Promise<unknown> {
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(body);
    throw new Error(
      parsedError.success ? parsedError.data.error : "Request failed",
    );
  }

  return body;
}

export async function importResults(xml: string) {
  const response = await fetch(`${apiBaseUrl}/import`, {
    method: "POST",
    headers: { "Content-Type": "text/xml+markr" },
    body: xml,
  });

  return importResponseSchema.parse(await apiJson(response));
}

export async function fetchTests() {
  const response = await fetch(`${apiBaseUrl}/tests`);
  const body = testsResponseSchema.parse(await apiJson(response));

  return body.tests;
}

export async function fetchTestResults(testId: string) {
  const encodedTestId = encodeURIComponent(testId);
  const [aggregateResponse, histogramResponse] = await Promise.all([
    fetch(`${apiBaseUrl}/results/${encodedTestId}/aggregate`),
    fetch(`${apiBaseUrl}/results/${encodedTestId}/histogram`),
  ]);

  if (aggregateResponse.status === 404 || histogramResponse.status === 404) {
    return null;
  }

  const [aggregateBody, histogramBody] = await Promise.all([
    apiJson(aggregateResponse),
    apiJson(histogramResponse),
  ]);

  return {
    aggregate: aggregateResponseSchema.parse(aggregateBody),
    histogram: histogramResponseSchema.parse(histogramBody),
    lastRefreshed: new Date().toLocaleString(),
  };
}

export function testResultsEventsUrl(testId: string) {
  return `${apiBaseUrl}/results/${encodeURIComponent(testId)}/events`;
}
