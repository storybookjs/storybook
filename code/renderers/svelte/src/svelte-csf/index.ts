import type { Meta } from '@storybook/svelte';
import type { ComponentType } from 'svelte';

import type { Args, StoryContext } from '#types';

import Story from './runtime/Story.svelte';

export { setTemplate } from './runtime/contexts/template.svelte';

export function defineMeta<const TOverrideArgs = unknown, const TMeta extends Meta = Meta>(
  meta: TMeta
) {
  return {
    Story: Story as ComponentType<Story<TOverrideArgs, TMeta>>,
    meta,
  };
}

export type { Args, StoryContext };
