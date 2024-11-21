import type { Addon_TestProviderState, Addon_TestProviderType } from '@storybook/core/types';

type DateNow = number;

export type TestProviderId = Addon_TestProviderType['id'];
export type TestProviderConfig = Addon_TestProviderType;
export type TestProviderState = Addon_TestProviderState;

export type TestProviders = Record<TestProviderId, TestProviderConfig & TestProviderState>;

export type TestingModuleRunRequestStory = {
  id: string; // button--primary
  name: string; // Primary
};

export type TestingModuleRunRequestPayload = {
  providerId: TestProviderId;
  payload: {
    importPath: string; // ./.../button.stories.tsx
    stories?: TestingModuleRunRequestStory[];
    componentPath?: string; // ./.../button.tsx
  }[];
};

export type TestingModuleRunAllRequestPayload = {
  providerId: TestProviderId;
};

export type TestingModuleProgressReportPayload =
  | {
      providerId: TestProviderId;
      status: 'success' | 'pending' | 'cancelled';
      cancellable?: boolean;
      progress?: TestingModuleProgressReportProgress;
      details?: { [key: string]: any };
    }
  | {
      providerId: TestProviderId;
      status: 'failed';
      progress?: TestingModuleProgressReportProgress;
      details?: { [key: string]: any };
      error: {
        name: string;
        message: string;
        stack?: string;
      };
    };

export type TestingModuleCrashReportPayload = {
  providerId: TestProviderId;
  error: {
    message: string;
  };
};

export type TestingModuleProgressReportProgress = {
  startedAt: DateNow;
  finishedAt?: DateNow;
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  percentageCompleted?: number;
};

export type Status = 'success' | 'failed' | 'pending';

export type TestingModuleCancelTestRunRequestPayload = {
  providerId: TestProviderId;
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
  providerId: TestProviderId;
  watchMode: boolean;
};
