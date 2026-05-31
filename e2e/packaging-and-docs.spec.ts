import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

import { repoRoot } from "./support/markr-helpers";

test("docker compose, README, and fixture-comment requirements stay testable", async () => {
  const compose = readFileSync(join(repoRoot, "docker-compose.yml"), "utf8");
  const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
  const exampleRequests = readFileSync(
    join(repoRoot, "docs/requirements/example-requests.sh"),
    "utf8",
  );
  const sampleXml = readFileSync(
    join(repoRoot, "docs/requirements/sample_results.xml"),
    "utf8",
  );

  expect(compose).toMatch(/4567:4567/);
  expect(compose).toMatch(/3000:3000/);
  expect(readme).toContain("Endorsed by the Taylor Swift Fan Club");
  expect(readme).toMatch(/assumptions/i);
  expect(readme).toMatch(/approach/i);
  expect(readme).toMatch(/build\/run|build and run|run locally/i);
  expect(readme).toMatch(/performance|query/i);
  expect(exampleRequests).toMatch(/wardAgainstGoblins/);
  expect(sampleXml).toMatch(
    /CullenExamScanner|JasperImportor|EsmeAggregator|AliceForesightController/,
  );
});
