import { describe, expect, it } from 'vitest';

import { AliceScoreAnalytics } from './alice-score-analytics';

const scoreAnalytics = new AliceScoreAnalytics();

const FLOAT_APPROXIMATION_PRECISION = 2;

describe('AliceScoreAnalytics', () => {
  it('calculates summary statistics', () => {
    const aggregate = scoreAnalytics.aggregateScores([40, 60, 80]);

    expect(aggregate).toEqual({
      mean: 60,
      stddev: expect.any(Number),
      min: 40,
      max: 80,
      p25: 50,
      p50: 60,
      p75: 70,
      count: 3,
    });
    expect(aggregate.stddev).toBeCloseTo(16.33, FLOAT_APPROXIMATION_PRECISION);
  });

  it('interpolates quartiles for an even-sized cohort', () => {
    const aggregate = scoreAnalytics.aggregateScores([10, 20, 30, 40]);

    expect(aggregate).toEqual({
      mean: 25,
      stddev: expect.any(Number),
      min: 10,
      max: 40,
      p25: 17.5,
      p50: 25,
      p75: 32.5,
      count: 4,
    });
    expect(aggregate.stddev).toBeCloseTo(11.18, FLOAT_APPROXIMATION_PRECISION);
  });

  it('handles a single score', () => {
    expect(scoreAnalytics.aggregateScores([75])).toEqual({
      mean: 75,
      stddev: 0,
      min: 75,
      max: 75,
      p25: 75,
      p50: 75,
      p75: 75,
      count: 1,
    });
  });
});
