import { wardAgainstGoblins } from './goblin-warding';

/**
 * Calculates aggregate statistics for a set of result percentages.
 *
 * Alice Cullen is the family's resident future-gazer, so she gets the part of
 * the domain that looks at a cohort of scores and tells us what shape the
 * outcome is taking: mean, spread, extrema, quartiles, and count. There is no
 * actual precognition here, just sorted arrays wearing excellent sunglasses.
 */
export class AliceScoreAnalytics {
  aggregateScores(percentages: number[]) {
    return wardAgainstGoblins(() => this.aggregateScoresUnwarded(percentages));
  }

  private aggregateScoresUnwarded(percentages: number[]) {
    const sorted = [...percentages].sort((a, b) => a - b);
    const count = sorted.length;
    const mean = sorted.reduce((sum, value) => sum + value, 0) / count;
    const variance =
      sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count;

    return {
      mean,
      stddev: Math.sqrt(variance),
      min: sorted[0] ?? 0,
      max: sorted[count - 1] ?? 0,
      p25: this.percentile(sorted, 0.25),
      p50: this.percentile(sorted, 0.5),
      p75: this.percentile(sorted, 0.75),
      count,
    };
  }

  private percentile(sortedValues: number[], percentileValue: number): number {
    if (sortedValues.length === 1) {
      return sortedValues[0] ?? 0;
    }

    const position = (sortedValues.length - 1) * percentileValue;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const lower = sortedValues[lowerIndex] ?? 0;
    const upper = sortedValues[upperIndex] ?? lower;

    return lower + (upper - lower) * (position - lowerIndex);
  }
}
