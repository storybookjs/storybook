export const ADDON_ID = 'storybook/experimental-addon-coverage';
export const PARAM_KEY = 'coverage';

export const REQUEST_EVENT = `${ADDON_ID}/request`;
export const RESULT_EVENT = `${ADDON_ID}/result`;

export type RequestEventPayload = {
  importPath: string;
  componentPath: string;
};

export type ResultEventPayload = {
  data: any;
  content: string;
};
