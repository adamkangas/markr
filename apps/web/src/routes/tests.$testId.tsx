import type { AggregateResponse, HistogramResponse } from '@markr/contracts';
import {
  queryOptions,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@markr/ui/alert';
import { Button } from '@markr/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@markr/ui/card';

import { fetchTestResults, testResultsEventsUrl } from '../api';

const testResultsQueryOptions = (testId: string) =>
  queryOptions({
    queryKey: ['test-results', testId],
    queryFn: () => fetchTestResults(testId),
  });

export const Route = createFileRoute('/tests/$testId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(testResultsQueryOptions(params.testId)),
  component: TestDetailRoute,
  errorComponent: TestDetailError,
});

function TestDetailRoute() {
  const { testId } = Route.useParams();
  const queryClient = useQueryClient();
  const [resultsLoadedAnnouncement, setResultsLoadedAnnouncement] =
    useState('');
  const { data: results } = useSuspenseQuery(testResultsQueryOptions(testId));

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      return;
    }

    const events = new EventSource(testResultsEventsUrl(testId));
    let refreshTimer: number | undefined;
    let isSubscribed = true;

    const scheduleRefresh = () => {
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(async () => {
        await queryClient.invalidateQueries({
          queryKey: ['test-results', testId],
        });

        if (isSubscribed) {
          setResultsLoadedAnnouncement('New results loaded.');
        }
      }, 500);
    };

    events.addEventListener('results-updated', scheduleRefresh);

    return () => {
      isSubscribed = false;

      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }

      events.removeEventListener('results-updated', scheduleRefresh);
      events.close();
    };
  }, [queryClient, testId]);

  if (!results) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <Alert variant="destructive">
          <AlertTitle>Test not found</AlertTitle>
          <AlertDescription>
            No imported results matched test {testId}.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link to="/tests">View list</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="space-y-4">
        <h1 className="font-heading text-4xl font-semibold tracking-normal text-foreground">
          Test {testId}
        </h1>
        <p className="text-sm text-muted-foreground">
          Last refreshed {results.lastRefreshed}
        </p>
        <p
          aria-atomic="true"
          aria-label="Results update announcements"
          className="sr-only"
          role="status"
        >
          {resultsLoadedAnnouncement}
        </p>
      </header>

      <AggregateStats aggregate={results.aggregate} />
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Score distribution</CardTitle>
          <CardDescription>
            Students grouped by percentage bands.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Histogram histogram={results.histogram} />
        </CardContent>
      </Card>
    </main>
  );
}

function AggregateStats({ aggregate }: { aggregate: AggregateResponse }) {
  const stats = [
    { key: 'mean', label: 'Mean', value: formatPercent(aggregate.mean) },
    { key: 'count', label: 'Count', value: String(aggregate.count) },
    {
      key: 'p25',
      label: '25th percentile',
      value: formatPercent(aggregate.p25),
    },
    { key: 'p50', label: 'Median', value: formatPercent(aggregate.p50) },
    {
      key: 'p75',
      label: '75th percentile',
      value: formatPercent(aggregate.p75),
    },
    { key: 'min', label: 'Minimum', value: formatPercent(aggregate.min) },
    { key: 'max', label: 'Maximum', value: formatPercent(aggregate.max) },
    {
      key: 'stddev',
      label: 'Standard deviation',
      value: formatPercent(aggregate.stddev),
    },
  ] as const;

  return (
    <ul
      aria-label="Aggregate statistics"
      className="grid list-none gap-4 p-0 sm:grid-cols-4"
    >
      {stats.map(({ key, label, value }) => (
        <li key={key}>
          <Card className="rounded-md" size="sm">
            <CardContent>
              <div className="space-y-1">
                <span className="sr-only">
                  {label}: {value}
                </span>
                <div aria-hidden="true">
                  <div className="text-sm text-muted-foreground">{label}</div>
                  <div className="text-2xl font-semibold text-foreground">
                    {value}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Histogram({ histogram }: { histogram: HistogramResponse }) {
  const highestCount = Math.max(...histogram.bins.map((bin) => bin.count), 1);

  return (
    <div>
      <ul
        aria-label="Score distribution"
        className="grid h-64 list-none grid-cols-10 gap-2 border-b border-l px-3 pb-2"
      >
        {histogram.bins.map((bin) => {
          const studentLabel = bin.count === 1 ? 'student' : 'students';
          const height = `${Math.max(6, (bin.count / highestCount) * 100)}%`;
          const label = `${bin.lower_pct} to ${bin.upper_pct} percent: ${bin.count} ${studentLabel}`;

          return (
            <li
              className="flex min-w-0 flex-col justify-end"
              key={`${bin.lower_pct}-${bin.upper_pct}`}
            >
              <span className="sr-only">{label}</span>
              <div
                aria-hidden="true"
                className="flex h-full min-h-0 flex-col items-center justify-end gap-1"
              >
                <span className="text-xs tabular-nums text-muted-foreground">
                  {bin.count}
                </span>
                <div
                  className="min-h-1 w-full rounded-t bg-primary transition-[height] duration-500 ease-out"
                  data-testid="histogram-bar"
                  style={{ height }}
                />
                <span className="text-center text-xs tabular-nums text-muted-foreground">
                  {bin.lower_pct}-{bin.upper_pct}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p
        aria-hidden="true"
        className="mt-2 text-center text-xs text-muted-foreground"
      >
        Score range (%)
      </p>
    </div>
  );
}

function TestDetailError({ error }: { error: Error }) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <Alert variant="destructive">
        <AlertTitle>Could not load results</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    </main>
  );
}

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : Number(value.toFixed(4))}%`;
}
