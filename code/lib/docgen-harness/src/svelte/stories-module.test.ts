// @vitest-environment happy-dom
import { expect, it } from 'vitest';

import Tag from './__testfixtures__/csf4-preview-meta/Tag.svelte';
import { composeModuleStory, readStoriesModule } from './stories-module.ts';

it('composes a CSF4 story with the args of its preview', async () => {
  const csf4 = readStoriesModule(await import('./__fixtures__/preview-args/input.stories.ts'));

  expect(composeModuleStory(csf4, csf4.stories.Default, 'Default').args).toEqual({
    removable: true,
    label: 'Meta label',
  });
});

it('keeps the preview of a CSF4 module out of a CSF3 module loaded after it', async () => {
  readStoriesModule(await import('./__fixtures__/preview-args/input.stories.ts'));
  const csf3 = readStoriesModule({
    default: { component: Tag, args: { label: 'Meta label' } },
    Default: { args: {} },
  });

  expect(composeModuleStory(csf3, csf3.stories.Default, 'Default').args).not.toHaveProperty(
    'removable'
  );
});
