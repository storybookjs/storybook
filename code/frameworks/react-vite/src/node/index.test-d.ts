import { expectTypeOf, it } from 'vitest';

import type { ReactTypes } from '@storybook/react/node';

import { reactVite } from './index.ts';

it('carries React story types through the framework renderer', () => {
  const framework = reactVite();
  expectTypeOf(framework.renderer.types).toEqualTypeOf<ReactTypes | undefined>();
  expectTypeOf<NonNullable<typeof framework.renderer.types>>().toEqualTypeOf<ReactTypes>();
});
