import { page } from '$app/state';

import DocsPageUser from './docs-page-user.svelte';

// Each story sets the SvelteKit mocks, so the docs page renders them in iframes, where each story
// has its own mocks
export default {
  title: 'stories/frameworks/sveltekit/modules/docs-page-isolated-mocks',
  component: DocsPageUser,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '60px' } },
  },
};

export const LoggedOut = {
  beforeEach() {
    page.data = { user: null };
  },
};

export const LoggedIn = {
  beforeEach() {
    page.data = { user: { name: 'Ada' } };
  },
};
