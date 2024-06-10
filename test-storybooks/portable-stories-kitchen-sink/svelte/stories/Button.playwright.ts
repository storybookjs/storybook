import { createTest } from '@storybook/svelte/experimental-playwright';
import { test as base } from '@playwright/experimental-ct-svelte';

import stories from './Button.stories.playwright';

const test = createTest(base);

test.skip('renders primary button', async ({ mount }) => {
  // TODO: this is not working, probably the translation that Playwright does not work with portable stories yet
  await mount(stories.WithLoader); 
});
