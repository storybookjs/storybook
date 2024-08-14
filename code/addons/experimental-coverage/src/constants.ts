import type { CoverageItem } from './types';

export const ADDON_ID = 'storybook/experimental-addon-coverage';
export const PARAM_KEY = 'coverage';

export const REQUEST_COVERAGE_EVENT = `${ADDON_ID}/request-coverage`;
export const RESULT_COVERAGE_EVENT = `${ADDON_ID}/result-coverage`;
export const RESULT_FILE_CONTENT = `${ADDON_ID}/result-file-content`;

export type RequestCoverageEventPayload = {
  importPath: string;
  componentPath: string;
  /** Is true if the Storybook manager starts the first time or the browser tab is reloaded */
  initialRequest: boolean;
};

export type ResultCoverageEventPayload = {
  coverage: CoverageItem;
  coverageSummary: any;
};

export type ResultFileContentPayload = {
  content: string;
};
