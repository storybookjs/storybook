import type { Channel } from 'storybook/internal/channels';

import { UniversalState } from './universal-state';

export const ADDON_ID = 'storybook/test';
export const TEST_PROVIDER_ID = `${ADDON_ID}/test-provider`;
export const PANEL_ID = `${ADDON_ID}/panel`;
export const STORYBOOK_ADDON_TEST_CHANNEL = 'STORYBOOK_ADDON_TEST_CHANNEL';

export const TUTORIAL_VIDEO_LINK = 'https://youtu.be/Waht9qq7AoA';
export const DOCUMENTATION_LINK = 'writing-tests/test-addon';
export const DOCUMENTATION_DISCREPANCY_LINK = `${DOCUMENTATION_LINK}#what-happens-when-there-are-different-test-results-in-multiple-environments`;
export const DOCUMENTATION_FATAL_ERROR_LINK = `${DOCUMENTATION_LINK}#what-happens-if-vitest-itself-has-an-error`;

let myUniversalState: UniversalState<Record<string, any>>;

export function getUniversalState(channel: Channel) {
  if (!myUniversalState) {
    myUniversalState = new UniversalState<Record<string, any>>(ADDON_ID, channel, {
      message: 'default state',
      randomNumber: Math.random(),
    });
  }
  return myUniversalState;
}
