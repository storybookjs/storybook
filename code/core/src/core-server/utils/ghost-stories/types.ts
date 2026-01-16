export interface StoryTestResult {
  storyId: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  error?: string;
  stack?: string;
}

export interface CategorizedError {
  category: string;
  count: number;
  uniqueCount: number;
  matchedDependencies: string[];
}

export interface ErrorCategorizationResult {
  totalErrors: number;
  categorizedErrors: Record<string, CategorizedError>;
  uniqueErrorCount: number;
}

export interface TestRunSummary {
  duration?: number;
  summary?: {
    total: number;
    passed: number;
    passedButEmptyRender: number;
    successRate: number;
    successRateWithoutEmptyRender: number;
    uniqueErrorCount: number;
    categorizedErrors: Record<string, CategorizedError>;
  };
  // Error message if the operation failed
  runError?: string;
}
