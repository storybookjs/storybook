import { internal_fullStatusStore } from 'storybook/manager-api';

// This is temporary, so we can clear statuses between each Playwright tests
// will be removed when we have a clear button to actually do this in the UI

globalThis.clearStatuses = () => {
  internal_fullStatusStore.unset();
};
