export const ADDON_ID = 'storybook/before-after';
export const PAGE_ID = `${ADDON_ID}/page`;
export const TOOL_ID = `${ADDON_ID}/tool`;
export const PARAM_KEY = 'beforeAfter';
export const CHANGES_URL = '/changes/';

const REQUEST_SERVER = `${ADDON_ID}/request-server`;
const REQUEST_SERVER_STATUS = `${ADDON_ID}/request-server-status`;
const SERVER_READY = `${ADDON_ID}/server-ready`;
const SERVER_READY_V2 = `${ADDON_ID}/server-ready-v2`;
const SERVER_ERROR = `${ADDON_ID}/server-error`;
const HEAD_CHANGED = `${ADDON_ID}/head-changed`;

export const EVENTS = {
  REQUEST_SERVER,
  REQUEST_SERVER_STATUS,
  SERVER_READY,
  SERVER_READY_V2,
  SERVER_ERROR,
  HEAD_CHANGED,
};
