export interface StoryTestResult {
  // The story id
  storyId: string;
  // Test status
  status: 'PASS' | 'FAIL' | 'PENDING';
  error?: string;
  stack?: string;
}

export interface ClassifiedError {
  category: string;
  description: string;
  count: number;
  examples: string[];
}

export interface GhostStoriesResponsePayload {
  success: boolean;
  duration: number;
  testSummary?: {
    total: number;
    passed: number;
    passedButEmptyRender: number;
    failed: number;
    successRate: number;
    successRateWithoutEmptyRender: number;
    failureRate: number;
    uniqueErrorCount: number;
    classifiedErrors: ClassifiedError[];
  };
  // Error message if the operation failed
  error?: string;
}
