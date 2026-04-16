export const ADDON_ID = 'storybook/before-after';
export const PAGE_ID = `${ADDON_ID}/page`;
export const TOOL_ID = `${ADDON_ID}/tool`;
export const PARAM_KEY = 'beforeAfter';
export const CHANGES_URL = '/changes/';

const REQUEST_SERVER = `${ADDON_ID}/request-server`;
const SERVER_READY = `${ADDON_ID}/server-ready`;
const SERVER_ERROR = `${ADDON_ID}/server-error`;
const HEAD_CHANGED = `${ADDON_ID}/head-changed`;

export const EVENTS = {
  REQUEST_SERVER,
  SERVER_READY,
  SERVER_ERROR,
  HEAD_CHANGED,
};
