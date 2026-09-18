import type { TestRunAnalysis } from '../../../shared/utils/test-result-types.ts';

export interface TestRunSummary {
  duration?: number;
  summary?: TestRunAnalysis;
  // Error message if the operation failed
  runError?: string;
}
