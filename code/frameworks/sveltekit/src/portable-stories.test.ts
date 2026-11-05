// @vitest-environment happy-dom
import { expect, it } from 'vitest';

import type { Component } from 'svelte';

import { composeStory, setProjectAnnotations } from './index.ts';
import * as svelteKitPreview from './preview.ts';

it('loads a composed story, which runs the SvelteKit beforeEach before there is a canvas', async () => {
  setProjectAnnotations([svelteKitPreview]);
  const Story = composeStory({ args: {} }, { title: 'Badge', component: {} as Component });

  await expect(Story.load()).resolves.toBeUndefined();
});
