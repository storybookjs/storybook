import { expectTypeOf, it } from 'vitest';

import type * as renderer from '@storybook/svelte';

import type * as framework from './index.ts';

it('exports Svelte CSF, so stories files can import it from the framework', () => {
  expectTypeOf<typeof framework.defineMeta>().toEqualTypeOf<typeof renderer.defineMeta>();
  expectTypeOf<framework.Args>().toEqualTypeOf<renderer.Args>();
  expectTypeOf<framework.StoryContext>().toEqualTypeOf<renderer.StoryContext>();
});
