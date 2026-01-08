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
  // Final test summary
  testSummary: {
    total: number;
    passed: number;
    failed: number;
    failureRate: number;
    successRate: number;
    successRateWithoutEmptyRender: number;
    classifiedErrors: ClassifiedError[];
    uniqueErrorCount: number;
    passingCount: number;
    failingCount: number;
    passedButEmptyRenderCount: number;
    pending?: number;
  };
  // Error message if the operation failed
  error?: string;
}
