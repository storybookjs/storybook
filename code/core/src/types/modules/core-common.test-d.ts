import { expectTypeOf, test } from 'vitest';

import type { StorybookConfigRaw } from './core-common.ts';

type Refs = NonNullable<StorybookConfigRaw['refs']>;

test('accepts the documented refs shape', () => {
  // The documented shape of `refs`: https://storybook.js.org/docs/api/main-config/main-config-refs
  // `satisfies` is the real check here, since it applies excess-property checks.
  const refs = {
    'design-system': {
      title: 'Storybook Design System',
      url: 'https://master--5ccbc373887ca40020446347.chromatic.com/',
      expanded: false,
      sourceUrl: 'https://github.com/storybookjs/storybook',
    },
    'auto-composed-package': {
      disable: true,
    },
  } satisfies Refs;

  expectTypeOf(refs).toExtend<Refs>();
});

test('still rejects unknown keys on a ref', () => {
  const refs = {
    // @ts-expect-error a misspelled key must still be rejected
    typo: { title: 't', url: 'u', sourceURL: 's' },
  } satisfies Refs;

  expectTypeOf(refs).not.toBeAny();
});
