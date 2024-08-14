export const ADDON_ID = 'storybook/experimental-addon-coverage';
export const PARAM_KEY = 'coverage';

export const REQUEST_COVERAGE_EVENT = `${ADDON_ID}/request-coverage`;
export const RESULT_COVERAGE_EVENT = `${ADDON_ID}/result-coverage`;
export const RESULT_FILE_CONTENT = `${ADDON_ID}/result-file-content`;

export type RequestEventPayload = {
  importPath: string;
  componentPath: string;
};

export type ResultCoverageEventPayload = {
  coverage: any;
  coverageSummary: any;
};

export type ResultFileContentPayload = {
  content: string;
};
