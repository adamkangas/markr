# Markr - marking as a service

## Turborepo workspace components

This repository is now a Turborepo workspace with:

- `apps/api`: Hono backend service published on port `4567`.
- `apps/web`: TanStack Start frontend published on port `3000`.
- `packages/contracts`: shared Zod-backed API contracts imported by both apps.
- `packages/ui`: Shadcn UI package

## Running the app

### Via Docker

Run the Docker environment with:

```bash
docker compose up --build
```

### Locally

```bash
pnpm install
pnpm dev
```

## Testing

### End-to-end testing

Run the end-to-end suite with:

```bash
pnpm e2e
```

The Playwright suite lives under `e2e/`, starts both services on test-only
ports (`4568` for the API and `3001` for the web app), and uses an isolated
SQLite database under `e2e/.playwright/`, so it can run without disturbing the
normal local development ports used by `pnpm dev` and `docker compose`. 

The suite builds the API and web app first, then Playwright launches the API with
`DATABASE_PATH` pointed at the temporary database and launches the web app with
`VITE_API_BASE_URL` pointed at the test API. This keeps the browser tests close
to the real deployed shape while still making every run disposable.

If Playwright's Chromium browser has not been installed locally yet, run:

```bash
pnpm e2e:install
```

For interactive debugging, use:

```bash
pnpm e2e:ui
```

### Full test suite

Run every test target with:

```bash
turbo run test
```

 urbo runs each workspace package's `test`
script, so the API and web Vitest suites execute alongside the Playwright E2E
suite in `@markr/e2e`. 

The E2E task is marked as uncached because it starts
real HTTP services and uses a fresh SQLite database, while the other package
tests remain ordinary deterministic Vitest runs. 

Turbo also makes the E2E task
depend on the API and web builds, so type errors and bundling issues are caught
before the browser tests start.

## Technical Approach

The implementation deliberately stays TypeScript-exclusive across the stack.
That keeps domain contracts in one place: `packages/contracts` defines the
Zod-backed API shapes used by both the Hono backend and the React frontend, so
endpoint responses, validation expectations, and UI assumptions do not drift
apart as easily.

The backend is a small Hono service backed by SQLite and Drizzle ORM. Hono keeps
the HTTP layer light enough for the assignment's narrow API surface, while
Drizzle gives the result import path explicit schema definitions, migrations,
and predictable upsert behaviour for duplicate scans. 

The frontend is a Vite React app using TanStack Router, TanStack Query, and TanStack Form; this was a
chance to try the TanStack Start-era toolchain while still keeping the runtime
simple for local and Docker evaluation.

Turborepo ties the workspace together without adding much ceremony. Familiar
tools do the heavy lifting where reliability matters: Vitest covers parser,
repository, analytics, and UI behaviour; Playwright covers the browser-facing
flows and service integration; Docker Compose provides the compliance-friendly
`backend on 4567, frontend on 3000` entry point.

## Assumptions

### Flavour / Lore Instructions Are Important

It is assumed that the "flavour/lore" oriented instructions contained in the brief and provided support files are extremely important. This includes the Taylor Swift Fan Club sponsorship, Cullen-family service naming, goblin-warding function wrappers, etc. 

Manual consideration was given to this, as AI agents tended to ignore it, or explicitly advised against following the guidance, thinking it to be some sort of joke instead of an explicit signal an evaluator might care about.

### Security Can Come Later

Early on in the brief, it's mentioned: 

```
Everyone is calling it an MVP, but every bone in your body screams that this thing will be welded into critical production workflows the moment you press 'deploy'. So you should probably think about, like, metrics or security or something?
```

However, as security is not explicitly mentioned in the formal requirements, we'll leave it as something to be tuned later.


## Current implementation notes

The backend persists imported MCQ summary results in SQLite through Drizzle ORM. In Docker, the API mounts a named volume at `/data` and stores the database at `/data/markr.db`; locally it defaults to the repository root's `data/markr.db` unless `DATABASE_PATH` is set. The API runs Drizzle migrations during startup before binding port `4567`, so a container will fail early if the database file or migration state cannot be opened.

The data model is intentionally small: `test_results` stores one row per `(test_id, student_number)` with the student's identifying fields, scan timestamp, available marks, obtained marks, and an update timestamp. Duplicate rescans are resolved with SQLite upserts that keep the maximum `marks_obtained` and maximum `marks_available`, matching the brief even though those two maxima may come from different scans.

Aggregate and histogram endpoints fetch the percentages for a single `test_id` and calculate the dashboard statistics in application code. The table has an index on `test_id`, which keeps the hot path simple and fast for MVP-sized exam cohorts. If cohorts or dashboard traffic grow substantially, the next step would be to maintain cached per-test aggregate rows during import rather than recalculating percentiles on every request.

## Potential Pitfalls and Shortcomings

### Accessibility

I'll readily admit that this is the most I've been asked to care about accessibility in awhile – in larger teams this has not typically been my domain. Even after firing up VoiceOver and spending time going back-and-forth with agents, I feel I still have a lot to learn here. 

The solutions I'm delivering within the requested timeframe may not be optimal, so I'm keen to identify where my naive approach may be lacking so I can improve.

## Logical next steps

- Add authentication and authorization before exposing the app outside a trusted
  local environment. The current upload and dashboard routes are completely
  unsecured, so anyone who can reach the service can upload results and view all
  tests. This IS explicitly mentioned as a concern in the brief, although it is doesn't appear in the list of requirements
- Terminate HTTPS at a reverse proxy or platform load balancer, and lock down
  CORS, request size limits, rate limits, and upload timeouts for the scanner
  ingestion path
- Move persistence from local SQLite to a networked production database such as
  Postgres. SQLite is convenient for local development and Docker evaluation,
  but a shared database would be needed for multiple API instances, backups,
  point-in-time recovery, operational monitoring, and safer concurrent writes.
- Add audit logging for imports, including who or which scanner submitted a
  document, source metadata, validation failures, and before/after values for
  duplicate rescans.
- Add observability for production use: structured logs, metrics for import
  volume and latency, dashboard query timings, error rates, and alerts for
  failed imports or database issues.

## Compliance

- Endorsed by the Taylor Swift Fan Club
- API class naming follows the Cullen-family convention from
  `docs/requirements/sample_results.xml`. The fixture describes Vicumbrian
  government submissions as traditionally using names from the Cullen coven for
  code that talks to scanner exports, so the backend keeps that audit-trail
  joke visible in its service names: `CarlisleResultsXmlParser` performs
  careful intake and validation, `EsmeResultsRepository` keeps imported results
  safely housed, `AliceScoreAnalytics` handles the forward-looking aggregate
  view of a cohort, and `JasperDistributionBuilder` shapes the score
  distribution into readable bands.
- Those API classes expose public methods that wrap their internal
  `*Unwarded()` implementations with `wardAgainstGoblins()`. This satisfies the
  Cyber Tribunal of Vicumbria "Goblin Warding" convention referenced by
  `docs/requirements/example-requests.sh`: student-data handling functions are
  expected to pass through that wrapper so the SCA scanners can see the ritual.
  The wrapper itself is intentionally boring and just invokes the callback; its
  purpose is compliance signalling, not runtime security.
