import { cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { isStory } from 'storybook/internal/csf';

import { composeStories } from '../../portable-stories.ts';
import * as ExtendTemplateStories from '../../../template/stories/svelte-csf/extend.stories.svelte';
import * as ButtonStories from './button.stories.svelte';
import * as ExtendStories from './extend.stories.svelte';
import * as GenericComponentStories from './generic-component.stories.svelte';
import * as InteractionsStories from './interactions.stories.svelte';
import * as MetaTypeStories from './meta-type.stories.svelte';
import * as TemplatingStories from './templating.stories.svelte';
import * as TypeAfterMetaStories from './type-after-meta.stories.svelte';

afterEach(() => {
  cleanup();
});

const files = {
  ButtonStories,
  ExtendStories,
  ExtendTemplateStories,
  GenericComponentStories,
  InteractionsStories,
  MetaTypeStories,
  TemplatingStories,
  TypeAfterMetaStories,
};

describe.each(Object.entries(files))('%s', (_name, file) => {
  const stories = Object.entries(file).filter(([, story]) => isStory(story));

  it('has no default export', () => {
    expect(file).not.toHaveProperty('default');
  });

  it.each(stories)('renders %s and passes its play function', async (_exportName, Story) => {
    await Story.run();
  });
});

it('exports the stories of the Story components from meta.type<>()', () => {
  expect(Object.keys(MetaTypeStories).filter((key) => key !== '__namedExportsOrder')).toEqual([
    'Primary',
    'Icon',
  ]);
});

it('keeps the file order of the stories that extend a later story', () => {
  expect((ExtendTemplateStories as Record<string, unknown>).__namedExportsOrder).toEqual([
    'PrimarySmall',
    'Primary',
    'PrimaryLarge',
    'PrimaryLargeStarred',
    'PrimaryLargeStarredEnabled',
  ]);
});

it('composes the stories with composeStories', async () => {
  // The types of composeStories need a default export, which a CSF factories file doesn't have.
  const { Primary } = composeStories(ButtonStories as never) as Record<string, any>;

  expect(Primary.args).toEqual({ size: 'large', primary: true });
  await Primary.run();
});
