export interface StoryTestResult {
  storyId: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  error?: string;
  stack?: string;
}

export interface CategorizedError {
  category: string;
  description: string;
  count: number;
  examples: string[];
  matchedDependencies: string[];
}

export interface ErrorCategorizationResult {
  totalErrors: number;
  categorizedErrors: Record<string, CategorizedError>;
  uniqueErrorCount: number;
}

export interface TestRunSummary {
  success: boolean;
  duration?: number;
  summary?: {
    total: number;
    passed: number;
    passedButEmptyRender: number;
    failed: number;
    successRate: number;
    successRateWithoutEmptyRender: number;
    failureRate: number;
    uniqueErrorCount: number;
    categorizedErrors: Record<string, CategorizedError>;
  };
  // Error message if the operation failed
  error?: string;
}
