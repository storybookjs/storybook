import { page } from '$app/state';

import DocsPageUser from './docs-page-user.svelte';

// Each story sets the SvelteKit mocks, and the docs page renders them inline, so they would share
// the mocks: the docs page shows `SvelteKitMocksSharedOnDocsPageError`. Each story on its own
// renders as usual.
export default {
  title: 'stories/frameworks/sveltekit/modules/docs-page-shared-mocks',
  component: DocsPageUser,
  tags: ['autodocs'],
  parameters: {
    // The docs page fails on purpose; the stories are the same as in docs-page-isolated-mocks
    chromatic: { disableSnapshot: true },
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
