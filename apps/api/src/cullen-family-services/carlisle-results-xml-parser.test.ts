import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { CarlisleResultsXmlParser } from './carlisle-results-xml-parser';

const sampleResultsXml = readFileSync(
  new URL('../../../../docs/requirements/sample_results.xml', import.meta.url),
  'utf8',
);
const resultsXmlParser = new CarlisleResultsXmlParser();

describe('CarlisleResultsXmlParser', () => {
  it('parses valid MCQ result XML with summary marks encoded as attributes', () => {
    expect(
      resultsXmlParser.parse(`
        <mcq-test-results>
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>algebra-1</test-id>
            <summary-marks available="20" obtained="18" />
          </mcq-test-result>
        </mcq-test-results>
      `),
    ).toMatchObject([
      {
        testId: 'algebra-1',
        studentNumber: '12345',
        firstName: 'Ada',
        lastName: 'Lovelace',
        scannedOn: '2017-12-04T12:12:10+11:00',
        marksAvailable: 20,
        marksObtained: 18,
      },
    ]);
  });

  it('ignores answer elements and extra fields in favour of summary-marks', () => {
    expect(
      resultsXmlParser.parse(`
        <mcq-test-results batch-id="scanner-7">
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>summary-wins</test-id>
            <machine-note>paper was folded</machine-note>
            <answer question="1" marks-available="10" marks-awarded="0">A</answer>
            <summary-marks available="20" obtained="18" />
          </mcq-test-result>
        </mcq-test-results>
      `)[0],
    ).toMatchObject({
      marksAvailable: 20,
      marksObtained: 18,
    });
  });

  it('rejects XML documents that are not mcq-test-results exports', () => {
    expect(() =>
      resultsXmlParser.parse(`
        <student-profile>
          <student-number>12345</student-number>
        </student-profile>
      `),
    ).toThrowError('Invalid XML format');
  });

  it('rejects the whole document when any result is missing an important field', () => {
    expect(() =>
      resultsXmlParser.parse(`
        <mcq-test-results>
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>atomic-parse</test-id>
            <summary-marks available="20" obtained="18" />
          </mcq-test-result>
          <mcq-test-result scanned-on="2017-12-04T12:13:10+11:00">
            <first-name>Grace</first-name>
            <student-number>67890</student-number>
            <test-id>atomic-parse</test-id>
            <summary-marks available="20" obtained="19" />
          </mcq-test-result>
        </mcq-test-results>
      `),
    ).toThrowError('Invalid XML format');
  });

  it.each([
    ['empty body', ''],
    ['malformed XML', '<mcq-test-results><mcq-test-result></mcq-test-results>'],
    [
      'invalid scanned-on timestamp',
      `
        <mcq-test-results>
          <mcq-test-result scanned-on="not-a-date">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>bad-scan-date</test-id>
            <summary-marks available="20" obtained="18" />
          </mcq-test-result>
        </mcq-test-results>
      `,
    ],
    [
      'non-integer marks',
      `
        <mcq-test-results>
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>bad-marks</test-id>
            <summary-marks available="20" obtained="18.5" />
          </mcq-test-result>
        </mcq-test-results>
      `,
    ],
    [
      'obtained marks greater than available marks',
      `
        <mcq-test-results>
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>impossible-marks</test-id>
            <summary-marks available="20" obtained="21" />
          </mcq-test-result>
        </mcq-test-results>
      `,
    ],
    [
      'DOCTYPE declarations',
      `
        <!DOCTYPE mcq-test-results [
          <!ENTITY surprise "not today">
        ]>
        <mcq-test-results>
          <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Ada</first-name>
            <last-name>Lovelace</last-name>
            <student-number>12345</student-number>
            <test-id>doctype</test-id>
            <summary-marks available="20" obtained="18" />
          </mcq-test-result>
        </mcq-test-results>
      `,
    ],
  ])('rejects %s', (_caseName, xml) => {
    expect(() => resultsXmlParser.parse(xml)).toThrowError(
      'Invalid XML format',
    );
  });

  it('preserves leading zeroes and all 100 rows from the sample scanner export', () => {
    const rows = resultsXmlParser.parse(sampleResultsXml);

    expect(rows).toHaveLength(100);
    expect(new Set(rows.map((row) => row.testId))).toEqual(new Set(['9863']));
    expect(rows.map((row) => row.studentNumber)).toEqual(
      expect.arrayContaining(['002299', '002349']),
    );
  });
});
