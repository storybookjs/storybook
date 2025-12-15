export const ADDON_ID = 'storybook/a11y';
export const PANEL_ID = `${ADDON_ID}/panel`;
export const PARAM_KEY = `a11y`;
export const UI_STATE_ID = `${ADDON_ID}/ui`;
const RESULT = `${ADDON_ID}/result`;
const REQUEST = `${ADDON_ID}/request`;
const RUNNING = `${ADDON_ID}/running`;
const ERROR = `${ADDON_ID}/error`;
const MANUAL = `${ADDON_ID}/manual`;
const SELECT = `${ADDON_ID}/select`;

export const DOCUMENTATION_LINK = 'writing-tests/accessibility-testing';
export const DOCUMENTATION_DISCREPANCY_LINK = `${DOCUMENTATION_LINK}#why-are-my-tests-failing-in-different-environments`;

export const TEST_PROVIDER_ID = 'storybook/addon-a11y/test-provider';

export const EVENTS = { RESULT, REQUEST, RUNNING, ERROR, MANUAL, SELECT };

export const STATUS_TYPE_ID_COMPONENT_TEST = 'storybook/component-test';
export const STATUS_TYPE_ID_A11Y = 'storybook/a11y';
