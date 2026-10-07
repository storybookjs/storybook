import { describe, expectTypeOf, it } from 'vitest';

import type {
  AfterEach,
  BeforeEach,
  DecoratorFunction,
  LoaderFunction,
  PlayFunction,
  StrictArgTypes,
} from './story.ts';

describe('argTypes on the story context', () => {
  it('is unknown in lifecycle hooks', () => {
    expectTypeOf<Parameters<LoaderFunction>[0]['argTypes']>().toEqualTypeOf<unknown>();
    expectTypeOf<Parameters<BeforeEach>[0]['argTypes']>().toEqualTypeOf<unknown>();
    expectTypeOf<Parameters<PlayFunction>[0]['argTypes']>().toEqualTypeOf<unknown>();
    expectTypeOf<Parameters<AfterEach>[0]['argTypes']>().toEqualTypeOf<unknown>();
  });

  it('is resolved in decorators', () => {
    expectTypeOf<Parameters<DecoratorFunction>[1]['argTypes']>().toEqualTypeOf<StrictArgTypes>();
  });
});
