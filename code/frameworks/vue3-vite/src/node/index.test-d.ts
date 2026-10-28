import { expectTypeOf, it } from 'vitest';

import type { VueTypes } from '@storybook/vue3/node';

import { vue3Vite } from './index.ts';

it('carries Vue story types through the framework renderer', () => {
  const framework = vue3Vite();
  expectTypeOf(framework.renderer.types).toEqualTypeOf<VueTypes | undefined>();
});
