import { describe, expectTypeOf, it } from 'vitest';

import type { Args } from 'storybook/internal/types';

// We import from the manager API (the one we fixed)
// In the preview API context, useArgs would come from preview-api/modules/addons/hooks
// but in the manager/panel context it comes from manager-api/root
import { useArgs } from './root.tsx';

/**
 * Type tests for `useArgs` generic parameter support.
 *
 * Regression test for: https://github.com/storybookjs/storybook/issues/25070
 *
 * The `useArgs` hook should accept a generic type parameter that properly
 * constrains the returned args tuple. Without this fix, the manager API's
 * `useArgs` was not generic (unlike the preview API version), causing
 * type conflicts and losing type information.
 */
describe('useArgs generic types', () => {
  it('infers arg types from the generic parameter', () => {
    const [args, updateArgs, resetArgs, initialArgs] = useArgs<{
      name: string;
      age: number;
    }>();

    // args should be typed as the provided generic type
    expectTypeOf(args).toEqualTypeOf<{ name: string; age: number }>();

    // updateArgs should accept Partial<TArgs>
    expectTypeOf(updateArgs).toBeFunction();
    expectTypeOf(updateArgs).parameter(0).toMatchTypeOf<Partial<{ name: string; age: number }>>();

    // resetArgs should accept an optional array of keys of TArgs
    expectTypeOf(resetArgs).toBeFunction();

    // initialArgs should match TArgs
    expectTypeOf(initialArgs).toEqualTypeOf<{ name: string; age: number }>();
  });

  it('defaults to Args when no generic is provided', () => {
    const [args] = useArgs();

    // Should default to the base Args type
    expectTypeOf(args).toMatchTypeOf<Args>();
  });

  it('allows narrowing via the generic parameter', () => {
    interface CustomArgs {
      enabled: boolean;
      count: number;
      label?: string;
    }

    const [args, updateArgs, resetArgs] = useArgs<CustomArgs>();

    // args should be exactly CustomArgs
    expectTypeOf(args).toMatchTypeOf<CustomArgs>();

    // updateArgs should accept Partial<CustomArgs> — all fields optional
    updateArgs({ count: 42 });
    // @ts-expect-error - unknown field should error
    updateArgs({ unknown: 'value' });

    // resetArgs should accept key names as strings (from keyof)
    resetArgs(['count', 'label']);
  });
});
