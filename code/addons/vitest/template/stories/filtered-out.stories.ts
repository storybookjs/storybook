import { global as globalThis } from '@storybook/global';

export const sharedObject = { source: 'filtered-out' };

// Every story in this file is excluded from the Vitest run, so the file itself is never a test
// entry. It only exists to be imported by imports-filtered-out.stories.ts.
export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  args: { object: sharedObject },
  tags: ['!test', '!vitest'],
  excludeStories: ['sharedObject'],
};

export const Base = {};
