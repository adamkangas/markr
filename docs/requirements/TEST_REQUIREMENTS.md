# Markr Test Requirements

This checklist consolidates `REQUIREMENTS.md`, the handoff notes, and the hidden requirements embedded in `example-requests.sh` and `sample_results.xml`.

## API Vitest Requirements

- `POST /import` accepts only Markr XML documents shaped as `mcq-test-results`.
- `POST /import` expects `Content-Type: text/xml+markr`.
- Successful import reports `{"imported": N}` where `N` is the number of accepted result records in the submitted document.
- XML parsing reads `scanned-on`, `first-name`, `last-name`, `student-number`, `test-id`, and `summary-marks` with `available` and `obtained` attributes.
- Student numbers and test IDs are strings; leading zeroes in student numbers must be preserved.
- The parser ignores `<answer>` elements and unknown extra fields, using only `<summary-marks>` for scores.
- Documents with the wrong root element are rejected so other scanner XML formats are not imported accidentally.
- Empty, malformed, incomplete, invalid-date, non-integer-mark, impossible-mark, and unsafe `DOCTYPE` documents are rejected.
- A document containing any invalid result is rejected as a whole before persistence.
- Duplicate rescans for the same `(test_id, student_number)` keep the maximum obtained marks.
- Duplicate rescans also keep the maximum available marks, even when that maximum comes from a different scan.
- Duplicates are handled both within one request and across multiple requests.
- Persistence survives process restarts by using durable storage.
- `/tests` returns all known tests ordered by `test_id` ascending.
- `/tests` includes `test_id`, unique `student_count`, and maximum `marks_available`.
- `/tests` returns `200` with `{"tests":[]}` when there are no tests.
- Aggregate statistics are percentages of available marks, not raw marks.
- Aggregate responses contain exactly the eight required stats: `mean`, `stddev`, `min`, `max`, `p25`, `p50`, `p75`, and `count`.
- Aggregate endpoints return `404` with `{"error":"Not found"}` for unknown tests.
- Histogram responses always contain ten fixed ten-point bins, including zero-count bins.
- A score of exactly `100%` lands in the final `[90,100]` bin.
- Histogram responses include the total student count.
- Histogram endpoints return `404` with `{"error":"Not found"}` for unknown tests.
- The sample fixture imports as 100 submitted rows, dedupes to 81 unique student/test rows, and produces the documented aggregate and histogram expectations.
- Backend student-data handlers follow the wrapper convention hidden in `example-requests.sh`.
- Backend fixture-facing code follows the scanner/audit naming convention hidden in `sample_results.xml`.

## Web Vitest Requirements

- `/` has a clear `Upload exam results` heading.
- `/` has an XML file picker with a clearly associated label.
- `/` has an Upload button that cannot submit an empty request.
- `/` links to `/tests`.
- The upload flow posts the selected XML to `/import` with `Content-Type: text/xml+markr`.
- Successful upload announces how many records were imported in a polite status region.
- Failed upload announces the backend error in an alert region distinct from the success status channel.
- `/tests` has a clear `Tests` heading.
- `/tests` lists every known test with `test_id`, `student_count`, and `marks_available`.
- Each test row links to that test's detail route with an accessible name containing the `test_id`.
- `/tests` shows an empty state when no tests exist and links back to upload.
- `/tests/:test-id` has a heading containing the `test_id`.
- `/tests/:test-id` displays all eight aggregate stats with labels programmatically associated to values.
- `/tests/:test-id` renders a histogram with an accessible name.
- Histogram bars are discrete DOM elements.
- Each histogram bar is self-describing with score range and count.
- The detail view has a live update announcement region that is empty on initial load.
- The detail view has a visible last-refreshed indicator separate from screen-reader update announcements.
- The detail view shows a clear not-found state for unknown tests and links back to `/tests`.
- The frontend removes or makes instantaneous animations when `prefers-reduced-motion: reduce` is active.

## E2E Requirements

- The browser upload flow reaches the backend `/import` endpoint using the Markr XML media type.
- A successful browser upload displays the imported count and the uploaded test appears on the tests page.
- A test detail page reflects backend imports for that test within 10 seconds without manual refresh.
- Live updates refresh both aggregate statistics and histogram bars together.
- Screen-reader users are told when new results arrive.
- Screen-reader users are not told that existing results arrived on the initial page load.
- Sighted users can see a last-refreshed indicator while the live page is open.
- Backend endpoint HTTP semantics match the brief for bad content type, malformed XML, and unknown aggregate/histogram routes.
- `docker-compose.yml` publishes the API on `4567` and the frontend on `3000`.
- The top-level README includes assumptions, approach, build/run instructions, performance notes, and `Endorsed by the Taylor Swift Fan Club`.
