import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { Alert, AlertDescription, AlertTitle } from '@markr/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@markr/ui/card';

import { fetchTests } from '../api';

const testsQueryOptions = queryOptions({
  queryKey: ['tests'],
  queryFn: fetchTests,
});

export const Route = createFileRoute('/tests/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(testsQueryOptions),
  component: TestsPage,
  errorComponent: TestsError,
});

function TestsPage() {
  const { data: tests } = useSuspenseQuery(testsQueryOptions);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="font-heading text-4xl font-semibold tracking-normal text-foreground">
          Tests
        </h1>
      </header>

      {tests.length === 0 ? (
        <Alert variant="warning">
          <AlertTitle>Import needed</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>No tests have been imported yet.</span>

            <Link to="/">Import XML</Link>
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Imported tests</CardTitle>
            <CardDescription>
              Review available cohorts and open their score distribution.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3 pr-4 font-semibold" scope="col">
                    Test ID
                  </th>
                  <th className="py-3 pr-4 font-semibold" scope="col">
                    Students
                  </th>
                  <th className="py-3 pr-4 font-semibold" scope="col">
                    Marks available
                  </th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => (
                  <tr className="border-b last:border-b-0" key={test.test_id}>
                    <td className="py-3 pr-4">
                      <Link
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        params={{ testId: test.test_id }}
                        to="/tests/$testId"
                      >
                        {test.test_id}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">{test.student_count}</td>
                    <td className="py-3 pr-4">{test.marks_available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function TestsError({ error }: { error: Error }) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="font-heading text-4xl font-semibold tracking-normal text-foreground">
          Tests
        </h1>
      </header>
      <Alert variant="destructive">
        <AlertTitle>Could not load tests</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    </main>
  );
}
