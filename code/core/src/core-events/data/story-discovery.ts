export interface StoryDiscoveryRequestPayload {
  // Number of stories to generate (default: 20)
  sampleSize: number;
  // Optional glob pattern to limit component search (default: "**/*.{ts,tsx,js,jsx}")
  globPattern?: string;
}

export interface GeneratedStoryInfo {
  // The story id
  storyId: string;
  // The story file path relative to the cwd
  storyFilePath: string;
  // The component name
  componentName: string;
  // Original component file path
  componentFilePath: string;
}

export interface StoryTestResult {
  // The story id
  storyId: string;
  // Test status
  status: 'PASS' | 'FAIL' | 'PENDING';
  // Error message if test failed
  error?: string;
  // Original component file path (for UI mapping)
  componentFilePath?: string;
}

export interface StoryDiscoveryProgressPayload {
  // Current phase of the operation
  phase: 'generating' | 'testing';
  // Progress information
  progress: {
    // For generation phase: number of stories generated so far
    generatedCount?: number;
    // For testing phase: current test results
    testResults?: StoryTestResult[];
    testSummary?: {
      total: number;
      passed: number;
      failed: number;
      pending: number;
    };
  };
}

export interface StoryDiscoveryResponsePayload {
  success: boolean;
  // List of successfully generated stories
  generatedStories: GeneratedStoryInfo[];
  // Final test results
  testResults: StoryTestResult[];
  // Final test summary
  testSummary: {
    total: number;
    passed: number;
    failed: number;
    failureRate: number;
    successRate: number;
    successRateWithoutEmptyRender: number;
    uniqueErrors: string[];
    uniqueErrorCount: number;
    passingCount: number;
    failingCount: number;
    passedButEmptyRenderCount: number;
    passedComponentPaths: string[];
  };
  // Error message if the operation failed
  error?: string;
}

export interface RunStoryTestsRequestPayload {
  storyIds: string[];
}

export interface RunStoryTestsResponsePayload {
  success: boolean;
  testResults: StoryTestResult[];
  testSummary: {
    total: number;
    passed: number;
    failed: number;
    failureRate: number;
    successRate: number;
    successRateWithoutEmptyRender: number;
    uniqueErrors: string[];
    uniqueErrorCount: number;
    passingCount: number;
    failingCount: number;
    passedButEmptyRenderCount: number;
    passedComponentPaths: string[];
  };
  duration: number;
  error?: string;
}
