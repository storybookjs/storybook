export type ProviderId = string;

export type TestingModuleRunRequestStories = {
  id: string;
  name: string;
};

export type TestingModuleRunRequestPayload = {
  providerId: ProviderId;
  payload: {
    stories: TestingModuleRunRequestStories[];
    importPath: string;
    componentPath: string;
  }[];
};

export type TestingModuleRunAllRequestPayload = {
  providerId: ProviderId;
};

export type TestingModuleRunProgressPayload =
  | {
      providerId: ProviderId;
      payload: TestingModuleRunResponsePayload;
      status: 'success' | 'pending';
    }
  | {
      providerId: ProviderId;
      error: {
        name: string;
        message: string;
        stack?: string;
      };
      status: 'failed';
    };

export type TestingModuleRunResponsePayload = {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  progress: number;
  startTime: number;
  success: boolean;
  testResults: TestingModuleRunTestResultPayload[];
};

export type TestingModuleRunTestResultPayload = {
  results: TestingModuleRunAssertionResultPayload[];
  startTime: number;
  endTime: number;
  status: 'passed' | 'failed';
  message?: string;
};

export type TestingModuleRunAssertionResultPayload =
  | {
      status: 'success' | 'pending';
      duration: number;
      storyId: string;
      data: any;
    }
  | {
      status: 'failed';
      duration: number;
      failureMessages: string[];
      storyId: string;
      data: any;
    };

export type Status = 'success' | 'failed' | 'pending';

export type TestingModuleCancelTestRunRequestPayload = {
  providerId: ProviderId;
};

export type TestingModuleCancelTestRunResponsePayload =
  | {
      status: 'success';
    }
  | {
      status: 'failed';
      message: string;
    };

export type TestingModuleWatchModeRequestPayload = {
  providerId: ProviderId;
  watchMode: boolean;
};
