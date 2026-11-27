import { cleanup } from '@testing-library/svelte';
import { afterEach, it } from 'vitest';

import { composeStories } from '../../portable-stories.ts';
import * as AsChildStories from './as-child.stories.svelte';

afterEach(() => {
  cleanup();
});

it('renders a story whose asChild prop changes', async () => {
  // The `.svelte` module types have no default export, which composeStories needs.
  const { Dynamic } = composeStories(AsChildStories as never) as Record<string, any>;

  await Dynamic.run();
});
