import type { CoverageItem, TestingMode } from './types';

export const ADDON_ID = 'storybook/experimental-addon-coverage';
export const PARAM_KEY = 'coverage';

export const REQUEST_COVERAGE_EVENT = `${ADDON_ID}/request-coverage`;
export const RESULT_COVERAGE_EVENT = `${ADDON_ID}/result-coverage`;
export const HMR_COVERAGE_EVENT = `${ADDON_ID}/hmr-coverage`;
export const RESULT_FILE_CONTENT = `${ADDON_ID}/result-file-content`;

export type RequestCoverageEventPayload = {
  importPath: string;
  componentPath: string;
  /** Is true if the Storybook manager starts the first time or the browser tab is reloaded */
  initialRequest: boolean;
  mode?: TestingMode;
};

export type ResultCoverageEventPayloadSuccess = {
  stats: CoverageItem;
  summary: any;
  // in milliseconds
  executionTime: number;
};

export type ResultCoverageEventPayload =
  | {
      stats: CoverageItem;
      summary: any;
      // in milliseconds
      executionTime: number;
    }
  | {
      errorCode: 'NO_TESTS';
    };

export type ResultFileContentPayload = {
  content: string;
};

export type HMRCoveragePayload = {
  startTime: number;
};
