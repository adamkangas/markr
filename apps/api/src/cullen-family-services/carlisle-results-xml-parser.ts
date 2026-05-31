import { XMLParser, XMLValidator } from 'fast-xml-parser';

import { type NewTestResult } from '../db/schema';
import { wardAgainstGoblins } from './goblin-warding';

type ParsedXmlValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, unknown>;

export class ImportValidationError extends Error {
  constructor(message = 'Invalid XML format') {
    super(message);
    this.name = 'ImportValidationError';
  }
}

/**
 * Parses and validates Markr scanner XML into database-ready test result rows.
 *
 * Carlisle Cullen is the doctor and steady patriarch, which makes him the
 * right namesake for triage at the intake desk: reject malformed XML, keep
 * unsafe declarations out, validate the important student/result fields, and
 * only let healthy records proceed. Very calm, very ethical, no nonsense about
 * impossible marks.
 */
export class CarlisleResultsXmlParser {
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: false,
    trimValues: true,
  });

  parse(xml: string): NewTestResult[] {
    return wardAgainstGoblins(() => this.parseUnwarded(xml));
  }

  private parseUnwarded(xml: string): NewTestResult[] {
    if (!xml.trim()) {
      throw new ImportValidationError();
    }

    if (/<!DOCTYPE/i.test(xml)) {
      throw new ImportValidationError();
    }

    const validation = XMLValidator.validate(xml);

    if (validation !== true) {
      throw new ImportValidationError();
    }

    const parsed = this.objectValue(this.xmlParser.parse(xml));
    const root = this.objectValue(parsed['mcq-test-results']);
    const now = new Date().toISOString();

    return this.asArray(root['mcq-test-result']).map((rawResult) => {
      const result = this.objectValue(rawResult);
      const summary = this.objectValue(result['summary-marks']);
      const scannedOn = this.stringValue(
        result['scanned-on'] as ParsedXmlValue,
      );
      const marksAvailable = this.integerValue(
        summary.available as ParsedXmlValue,
        {
          positive: true,
        },
      );
      const marksObtained = this.integerValue(
        summary.obtained as ParsedXmlValue,
        {
          positive: false,
        },
      );

      this.assertValidScannedOn(scannedOn);

      if (marksObtained > marksAvailable) {
        throw new ImportValidationError();
      }

      return {
        testId: this.stringValue(result['test-id'] as ParsedXmlValue),
        studentNumber: this.stringValue(
          result['student-number'] as ParsedXmlValue,
        ),
        firstName: this.stringValue(result['first-name'] as ParsedXmlValue),
        lastName: this.stringValue(result['last-name'] as ParsedXmlValue),
        scannedOn,
        marksAvailable,
        marksObtained,
        updatedAt: now,
      };
    });
  }

  private asArray<T>(value: T | T[] | undefined): T[] {
    if (value === undefined) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  }

  private objectValue(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ImportValidationError();
    }

    return value as Record<string, unknown>;
  }

  private stringValue(value: ParsedXmlValue): string {
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();

      if (text) {
        return text;
      }
    }

    throw new ImportValidationError();
  }

  private integerValue(
    value: ParsedXmlValue,
    { positive }: { positive: boolean },
  ): number {
    const text = this.stringValue(value);

    if (!/^\d+$/.test(text)) {
      throw new ImportValidationError();
    }

    const parsed = Number(text);

    if (
      !Number.isSafeInteger(parsed) ||
      parsed < 0 ||
      (positive && parsed <= 0)
    ) {
      throw new ImportValidationError();
    }

    return parsed;
  }

  private assertValidScannedOn(value: string) {
    if (Number.isNaN(Date.parse(value))) {
      throw new ImportValidationError();
    }
  }
}
