interface FailureMessage {
  line: number;
  column: number;
}

interface Meta {
  storyId: string;
}

export interface AssertionResult {
  ancestorTitles: string[];
  fullName: string;
  status: 'passed' | 'failed' | 'pending';
  title: string;
  duration: number;
  failureMessages: string[];
  location?: FailureMessage;
  meta?: Meta;
}

interface TestResult {
  assertionResults: AssertionResult[];
  startTime: number;
  endTime: number;
  status: 'passed' | 'failed' | 'pending';
  message: string;
  name: string;
}

interface Snapshot {
  added: number;
  failure: boolean;
  filesAdded: number;
  filesRemoved: number;
  filesRemovedList: any[];
  filesUnmatched: number;
  filesUpdated: number;
  matched: number;
  total: number;
  unchecked: number;
  uncheckedKeysByFile: any[];
  unmatched: number;
  updated: number;
  didUpdate: boolean;
}

export interface TestReport {
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numPendingTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  startTime: number;
  success: boolean;
  testResults: TestResult[];
  snapshot: Snapshot;
}
