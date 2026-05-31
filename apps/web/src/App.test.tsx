import { readFileSync } from "node:fs";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRouter } from "./router";

const aggregateResponse = {
  mean: 65,
  stddev: 4.25,
  min: 65,
  max: 65,
  p25: 65,
  p50: 65,
  p75: 65,
  count: 1,
};

const histogramResponse = {
  bins: [
    { lower_pct: 0, upper_pct: 10, count: 0 },
    { lower_pct: 10, upper_pct: 20, count: 0 },
    { lower_pct: 20, upper_pct: 30, count: 0 },
    { lower_pct: 30, upper_pct: 40, count: 0 },
    { lower_pct: 40, upper_pct: 50, count: 0 },
    { lower_pct: 50, upper_pct: 60, count: 0 },
    { lower_pct: 60, upper_pct: 70, count: 1 },
    { lower_pct: 70, upper_pct: 80, count: 0 },
    { lower_pct: 80, upper_pct: 90, count: 0 },
    { lower_pct: 90, upper_pct: 100, count: 0 },
  ],
  total: 1,
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      ...init,
    }),
  );
}

function routeTo(path: string) {
  window.history.pushState({}, "", path);
}

function renderAppAt(path: string) {
  const router = getRouter(createMemoryHistory({ initialEntries: [path] }));

  return render(<RouterProvider router={router} />);
}

function mockApi(
  implementation: (url: string, init?: RequestInit) => Promise<Response>,
) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    implementation(String(input), init),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function expectAggregateStatistic(
  aggregateStats: HTMLElement,
  label: string,
  value: string,
) {
  const stat = within(aggregateStats).getByText(`${label}: ${value}`);
  const listItem = stat.closest("li");

  expect(stat).toHaveClass("sr-only");
  expect(listItem).toBeInTheDocument();
  expect(within(listItem as HTMLElement).getByText(label)).toBeVisible();
  expect(within(listItem as HTMLElement).getByText(value)).toBeVisible();
}

beforeEach(() => {
  mockApi((url) => {
    if (url.endsWith("/tests")) {
      return jsonResponse({
        tests: [
          { test_id: "1234", student_count: 27, marks_available: 20 },
          { test_id: "5678", student_count: 3, marks_available: 10 },
        ],
      });
    }

    if (url.endsWith("/results/1234/aggregate")) {
      return jsonResponse(aggregateResponse);
    }

    if (url.endsWith("/results/1234/histogram")) {
      return jsonResponse(histogramResponse);
    }

    if (url.endsWith("/results/missing/aggregate")) {
      return jsonResponse({ error: "Not found" }, { status: 404 });
    }

    if (url.endsWith("/results/missing/histogram")) {
      return jsonResponse({ error: "Not found" }, { status: 404 });
    }

    return jsonResponse(
      { error: `Unexpected request: ${url}` },
      { status: 500 },
    );
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  routeTo("/");
});

describe("upload page", () => {
  it("renders the upload heading, labelled XML picker, active upload button, and tests link", async () => {
    renderAppAt("/");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /upload exam results/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/xml file/i)).toHaveAttribute("type", "file");
    expect(screen.getByRole("button", { name: /upload/i })).toBeEnabled();
    expect(screen.getByRole("link", { name: /tests/i })).toHaveAttribute(
      "href",
      "/tests",
    );
  });

  it("validates the missing XML file when upload is submitted", async () => {
    const fetchMock = vi.mocked(fetch);

    renderAppAt("/");

    fireEvent.click(await screen.findByRole("button", { name: /upload/i }));

    expect(
      await screen.findByText(/select an xml file to import/i),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the selected XML to /import with the Markr content type and announces success politely", async () => {
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith("/import")) {
        expect(init?.method).toBe("POST");
        expect(init?.headers).toEqual(
          expect.objectContaining({ "Content-Type": "text/xml+markr" }),
        );
        return jsonResponse({ imported: 2 });
      }

      return jsonResponse(
        { error: `Unexpected request: ${url}` },
        { status: 500 },
      );
    });

    renderAppAt("/");

    const file = new File(
      ["<mcq-test-results><mcq-test-result /></mcq-test-results>"],
      "results.xml",
      { type: "text/xml" },
    );

    fireEvent.change(await screen.findByLabelText(/xml file/i), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(await screen.findByRole("status")).toHaveTextContent(
      /2 records imported/i,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports backend rejection in an alert, distinct from the success status channel", async () => {
    mockApi((url) => {
      if (url.endsWith("/import")) {
        return jsonResponse({ error: "Invalid XML format" }, { status: 400 });
      }

      return jsonResponse(
        { error: `Unexpected request: ${url}` },
        { status: 500 },
      );
    });

    renderAppAt("/");

    fireEvent.change(await screen.findByLabelText(/xml file/i), {
      target: {
        files: [new File(["nope"], "broken.xml", { type: "text/xml" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /upload/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /invalid xml format/i,
    );

    const status = screen.queryByRole("status");
    expect(status?.textContent ?? "").not.toMatch(/records imported/i);
  });
});

describe("tests page", () => {
  it("lists every known test with required columns and accessible detail links", async () => {
    renderAppAt("/tests");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Tests" }),
    ).toBeInTheDocument();

    const firstRow = screen.getByRole("row", { name: /1234 27 20/i });

    expect(within(firstRow).getByText("1234")).toBeInTheDocument();
    expect(within(firstRow).getByText("27")).toBeInTheDocument();
    expect(within(firstRow).getByText("20")).toBeInTheDocument();
    expect(
      within(firstRow).getByRole("link", { name: /1234/i }),
    ).toHaveAttribute("href", "/tests/1234");
  });

  it("shows an empty state with a link back to upload when no tests exist", async () => {
    mockApi((url) => {
      if (url.endsWith("/tests")) {
        return jsonResponse({ tests: [] });
      }

      return jsonResponse(
        { error: `Unexpected request: ${url}` },
        { status: 500 },
      );
    });

    renderAppAt("/tests");

    expect(await screen.findByText(/no tests/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upload/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

describe("test detail page", () => {
  it("renders the test heading and all eight aggregate statistics with one screen-reader phrase each", async () => {
    renderAppAt("/tests/1234");

    expect(
      await screen.findByRole("heading", { level: 1, name: /1234/ }),
    ).toBeInTheDocument();

    const aggregateStats = screen.getByRole("list", {
      name: /aggregate statistics/i,
    });

    expect(within(aggregateStats).getAllByRole("listitem")).toHaveLength(8);
    expect(screen.queryAllByRole("term")).toHaveLength(0);
    expect(screen.queryAllByRole("definition")).toHaveLength(0);

    expectAggregateStatistic(aggregateStats, "Mean", "65%");
    expectAggregateStatistic(aggregateStats, "Count", "1");
    expectAggregateStatistic(aggregateStats, "25th percentile", "65%");
    expectAggregateStatistic(aggregateStats, "Median", "65%");
    expectAggregateStatistic(aggregateStats, "75th percentile", "65%");
    expectAggregateStatistic(aggregateStats, "Minimum", "65%");
    expectAggregateStatistic(aggregateStats, "Maximum", "65%");
    expectAggregateStatistic(aggregateStats, "Standard deviation", "4.25%");
  });

  it("renders an accessible DOM histogram with self-describing bars", async () => {
    renderAppAt("/tests/1234");

    const chart = await screen.findByRole("list", {
      name: /score distribution/i,
    });
    const expectedBarLabels = [
      "0 to 10 percent: 0 students",
      "10 to 20 percent: 0 students",
      "20 to 30 percent: 0 students",
      "30 to 40 percent: 0 students",
      "40 to 50 percent: 0 students",
      "50 to 60 percent: 0 students",
      "60 to 70 percent: 1 student",
      "70 to 80 percent: 0 students",
      "80 to 90 percent: 0 students",
      "90 to 100 percent: 0 students",
    ];

    expect(within(chart).getAllByRole("listitem")).toHaveLength(10);
    for (const label of expectedBarLabels) {
      expect(within(chart).getByText(label)).toHaveClass("sr-only");
    }
    expect(within(chart).getAllByTestId("histogram-bar")).toHaveLength(10);
    expect(within(chart).getByText("60-70")).toBeVisible();
    expect(within(chart).getByText("1")).toBeVisible();
    expect(screen.getByText("Score range (%)")).toBeVisible();
  });

  it("renders a visible last-refreshed indicator separate from update announcements", async () => {
    renderAppAt("/tests/1234");

    expect(await screen.findByText(/last refreshed/i)).toBeVisible();
    expect(
      screen.getByRole("status", { name: /results update announcements/i }),
    ).toBeEmptyDOMElement();
  });

  it("subscribes to result update events, debounces query invalidation, and announces after results load", async () => {
    const fetchMock = vi.mocked(fetch);

    class MockEventSource {
      static instances: MockEventSource[] = [];

      readonly listeners = new Map<string, Set<EventListener>>();
      readonly url: string;

      constructor(url: string | URL) {
        this.url = String(url);
        MockEventSource.instances.push(this);
      }

      addEventListener(type: string, listener: EventListener) {
        const listeners = this.listeners.get(type) ?? new Set<EventListener>();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }

      removeEventListener(type: string, listener: EventListener) {
        this.listeners.get(type)?.delete(listener);
      }

      close = vi.fn();

      dispatch(type: string, data: unknown = { testId: "1234" }) {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(
            new MessageEvent(type, {
              data: typeof data === "string" ? data : JSON.stringify(data),
            }),
          );
        }
      }
    }

    vi.stubGlobal("EventSource", MockEventSource);

    renderAppAt("/tests/1234");

    await screen.findByRole("heading", { level: 1, name: /1234/ });

    vi.useFakeTimers();

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe(
      "http://localhost:4567/results/1234/events",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);

    MockEventSource.instances[0].dispatch("results-updated", {
      testId: "different-test",
    });
    MockEventSource.instances[0].dispatch("results-updated", {
      unexpected: "shape",
    });
    MockEventSource.instances[0].dispatch("results-updated");
    MockEventSource.instances[0].dispatch("results-updated");
    MockEventSource.instances[0].dispatch("results-updated");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(
      screen.getByRole("status", { name: /results update announcements/i }),
    ).toHaveTextContent(/new results loaded/i);
  });

  it("shows a not-found state with a link back to the tests page", async () => {
    renderAppAt("/tests/missing");

    expect(await screen.findByText(/not found/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /tests/i })).toHaveAttribute(
      "href",
      "/tests",
    );
  });

  it("removes animation and transition effects when reduced motion is requested", () => {
    const css = readFileSync("src/styles.css", "utf8");

    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(/transition(?:-duration)?:\s*(?:none|0(?:ms|s)?)/);
    expect(css).toMatch(/animation(?:-duration)?:\s*(?:none|0(?:ms|s)?)/);
  });
});
