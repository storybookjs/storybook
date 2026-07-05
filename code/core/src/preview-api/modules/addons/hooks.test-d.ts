import { describe, expectTypeOf, it } from 'vitest';

import type { Args } from 'storybook/internal/types';

import { useArgs } from './hooks.ts';

type StoryArgs = { name: string; age: number };

describe('useArgs', () => {
  it('returns a readonly tuple preserving the generic type parameter', () => {
    type Result = ReturnType<typeof useArgs<StoryArgs>>;
    expectTypeOf<Result[0]>().toEqualTypeOf<StoryArgs>();
    expectTypeOf<Result[1]>().toEqualTypeOf<(newArgs: Partial<StoryArgs>) => void>();
    expectTypeOf<Result[2]>().toEqualTypeOf<(argNames?: (keyof StoryArgs)[]) => void>();
  });

  it('returns a readonly tuple with default Args type', () => {
    type Result = ReturnType<typeof useArgs>;
    expectTypeOf<Result[0]>().toEqualTypeOf<Args>();
  });

  it('tuple is readonly', () => {
    type Result = ReturnType<typeof useArgs<StoryArgs>>;
    expectTypeOf<Result>().toMatchTypeOf<readonly [StoryArgs, ...unknown[]]>();
  });
});
