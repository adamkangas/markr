import { wardAgainstGoblins } from "./goblin-warding";

/**
 * Builds a ten-bin histogram for percentage scores.
 *
 * Jasper Hale is the mood-and-battlefield tactician of the Cullen crew, so he
 * gets the distribution work: read the room, group the scores into orderly
 * bands, and make the emotional landscape of the test visible without getting
 * dramatic about a single percentage point.
 */
export class JasperDistributionBuilder {
  buildHistogram(percentages: number[]) {
    return wardAgainstGoblins(() => this.buildHistogramUnwarded(percentages));
  }

  private buildHistogramUnwarded(percentages: number[]) {
    const bins = Array.from({ length: 10 }, (_, index) => ({
      lower_pct: index * 10,
      upper_pct: (index + 1) * 10,
      count: 0,
    }));

    for (const percentage of percentages) {
      const index = percentage === 100 ? 9 : Math.floor(percentage / 10);
      bins[Math.max(0, Math.min(9, index))]!.count += 1;
    }

    return {
      bins,
      total: percentages.length,
    };
  }
}
