import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  aggregateResponseSchema,
  apiErrorSchema,
  histogramResponseSchema,
  importResponseSchema,
  serviceInfoSchema,
  testsResponseSchema,
} from '@markr/contracts';

import { runMigrations } from './db/migrate';
import {
  CarlisleResultsXmlParser,
  ImportValidationError,
} from './cullen-family-services/carlisle-results-xml-parser';
import { AliceScoreAnalytics } from './cullen-family-services/alice-score-analytics';
import { EsmeResultsRepository } from './cullen-family-services/esme-results-repository';
import { JasperDistributionBuilder } from './cullen-family-services/jasper-distribution-builder';

export const app = new Hono();

const eventEncoder = new TextEncoder();
const resultUpdateSubscribers = new Map<
  string,
  Set<ReadableStreamDefaultController<Uint8Array>>
>();

function subscribeToResultUpdates(
  testId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const subscribers = resultUpdateSubscribers.get(testId) ?? new Set();
  subscribers.add(controller);
  resultUpdateSubscribers.set(testId, subscribers);

  return () => {
    subscribers.delete(controller);
    if (subscribers.size === 0) {
      resultUpdateSubscribers.delete(testId);
    }
  };
}

function publishResultUpdates(testIds: string[]) {
  for (const testId of testIds) {
    const subscribers = resultUpdateSubscribers.get(testId);

    if (!subscribers) {
      continue;
    }

    const message = eventEncoder.encode(
      `event: results-updated\ndata: ${JSON.stringify({ testId })}\n\n`,
    );

    for (const subscriber of subscribers) {
      try {
        subscriber.enqueue(message);
      } catch {
        subscribers.delete(subscriber);
      }
    }

    if (subscribers.size === 0) {
      resultUpdateSubscribers.delete(testId);
    }
  }
}

const corsOrigins = (
  process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

runMigrations();

app.use(
  '*',
  cors({
    origin: corsOrigins,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
);

app.get('/health', (c) =>
  c.json(
    serviceInfoSchema.parse({
      app: 'markr',
      service: 'api',
      message: 'ok',
    }),
  ),
);

app.get('/tests', (c) =>
  c.json(
    testsResponseSchema.parse({
      tests: new EsmeResultsRepository().listTests(),
    }),
  ),
);

app.post('/import', async (c) => {
  const contentType = c.req.header('content-type') ?? '';

  if (!contentType.includes('text/xml+markr')) {
    return c.json(
      apiErrorSchema.parse({ error: 'Content-Type must be text/xml+markr' }),
      400,
    );
  }

  const body = await c.req.text();

  try {
    const results = new CarlisleResultsXmlParser().parse(body);
    const imported = new EsmeResultsRepository().importResults(results);
    publishResultUpdates([...new Set(results.map((result) => result.testId))]);

    return c.json(importResponseSchema.parse({ imported }));
  } catch (error) {
    if (error instanceof ImportValidationError) {
      return c.json(apiErrorSchema.parse({ error: error.message }), 400);
    }

    throw error;
  }
});

app.get('/results/:testId/events', (c) => {
  const testId = c.req.param('testId');
  let unsubscribe = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      unsubscribe = subscribeToResultUpdates(testId, controller);

      controller.enqueue(eventEncoder.encode(': connected\n\n'));
      c.req.raw.signal.addEventListener('abort', unsubscribe, { once: true });
    },
    cancel() {
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});

app.get('/results/:testId/aggregate', (c) => {
  const percentages = new EsmeResultsRepository().getPercentagesForTest(
    c.req.param('testId'),
  );

  if (percentages.length === 0) {
    return c.json(apiErrorSchema.parse({ error: 'Not found' }), 404);
  }

  return c.json(
    aggregateResponseSchema.parse(
      new AliceScoreAnalytics().aggregateScores(percentages),
    ),
  );
});

app.get('/results/:testId/histogram', (c) => {
  const percentages = new EsmeResultsRepository().getPercentagesForTest(
    c.req.param('testId'),
  );

  if (percentages.length === 0) {
    return c.json(apiErrorSchema.parse({ error: 'Not found' }), 404);
  }

  return c.json(
    histogramResponseSchema.parse(
      new JasperDistributionBuilder().buildHistogram(percentages),
    ),
  );
});

const port = Number(process.env.PORT ?? 4567);

if (process.env.NODE_ENV !== 'test') {
  serve(
    {
      fetch: app.fetch,
      port,
      hostname: '0.0.0.0',
    },
    (info) => {
      console.log(
        `[${new Date().toISOString()}] Markr API listening on http://localhost:${info.port}`,
      );
    },
  );
}
