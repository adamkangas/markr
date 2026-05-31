import { describe, expect, it } from 'vitest';

import { JasperDistributionBuilder } from './jasper-distribution-builder';

const distributionBuilder = new JasperDistributionBuilder();

describe('JasperDistributionBuilder', () => {
  it('places 100 percent scores in the final bin', () => {
    const histogram = distributionBuilder.buildHistogram([0, 9.9, 10, 100]);

    expect(histogram.total).toBe(4);
    expect(histogram.bins[0]).toEqual({
      lower_pct: 0,
      upper_pct: 10,
      count: 2,
    });
    expect(histogram.bins[1]).toEqual({
      lower_pct: 10,
      upper_pct: 20,
      count: 1,
    });
    expect(histogram.bins[9]).toEqual({
      lower_pct: 90,
      upper_pct: 100,
      count: 1,
    });
  });

  it('always returns ten fixed bins with zero-count bins included', () => {
    expect(distributionBuilder.buildHistogram([35, 45, 55])).toEqual({
      bins: [
        { lower_pct: 0, upper_pct: 10, count: 0 },
        { lower_pct: 10, upper_pct: 20, count: 0 },
        { lower_pct: 20, upper_pct: 30, count: 0 },
        { lower_pct: 30, upper_pct: 40, count: 1 },
        { lower_pct: 40, upper_pct: 50, count: 1 },
        { lower_pct: 50, upper_pct: 60, count: 1 },
        { lower_pct: 60, upper_pct: 70, count: 0 },
        { lower_pct: 70, upper_pct: 80, count: 0 },
        { lower_pct: 80, upper_pct: 90, count: 0 },
        { lower_pct: 90, upper_pct: 100, count: 0 },
      ],
      total: 3,
    });
  });

  it('puts exact lower boundaries into their matching bins', () => {
    expect(
      distributionBuilder.buildHistogram([
        0, 10, 20, 30, 40, 50, 60, 70, 80, 90,
      ]),
    ).toEqual({
      bins: [
        { lower_pct: 0, upper_pct: 10, count: 1 },
        { lower_pct: 10, upper_pct: 20, count: 1 },
        { lower_pct: 20, upper_pct: 30, count: 1 },
        { lower_pct: 30, upper_pct: 40, count: 1 },
        { lower_pct: 40, upper_pct: 50, count: 1 },
        { lower_pct: 50, upper_pct: 60, count: 1 },
        { lower_pct: 60, upper_pct: 70, count: 1 },
        { lower_pct: 70, upper_pct: 80, count: 1 },
        { lower_pct: 80, upper_pct: 90, count: 1 },
        { lower_pct: 90, upper_pct: 100, count: 1 },
      ],
      total: 10,
    });
  });
});
