import { z } from "zod";

export const serviceInfoSchema = z.object({
  app: z.literal("markr"),
  service: z.string().min(1),
  message: z.string().min(1),
});

export type ServiceInfo = z.infer<typeof serviceInfoSchema>;

export const testSummarySchema = z.object({
  test_id: z.string().min(1),
  student_count: z.number().int().nonnegative(),
  marks_available: z.number().int().positive(),
});

export const testsResponseSchema = z.object({
  tests: z.array(testSummarySchema),
});

export type TestsResponse = z.infer<typeof testsResponseSchema>;

export const importResponseSchema = z.object({
  imported: z.number().int().nonnegative(),
});

export type ImportResponse = z.infer<typeof importResponseSchema>;

export const aggregateResponseSchema = z.object({
  mean: z.number().min(0).max(100),
  stddev: z.number().min(0),
  min: z.number().min(0).max(100),
  max: z.number().min(0).max(100),
  p25: z.number().min(0).max(100),
  p50: z.number().min(0).max(100),
  p75: z.number().min(0).max(100),
  count: z.number().int().nonnegative(),
});

export type AggregateResponse = z.infer<typeof aggregateResponseSchema>;

export const histogramBinSchema = z.object({
  lower_pct: z.number().int().min(0).max(100),
  upper_pct: z.number().int().min(0).max(100),
  count: z.number().int().nonnegative(),
});

export const histogramResponseSchema = z.object({
  bins: z.array(histogramBinSchema).length(10),
  total: z.number().int().nonnegative(),
});

export type HistogramResponse = z.infer<typeof histogramResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.string().min(1),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const testResultsUpdatedEventName = "results-updated";

export const testResultsUpdatedEventPayloadSchema = z.object({
  testId: z.string().min(1),
});

export type TestResultsUpdatedEventPayload = z.infer<
  typeof testResultsUpdatedEventPayloadSchema
>;

export const testResultsUpdatedEventSchema = z.object({
  event: z.literal(testResultsUpdatedEventName),
  data: testResultsUpdatedEventPayloadSchema,
});

export type TestResultsUpdatedEvent = z.infer<
  typeof testResultsUpdatedEventSchema
>;
