import { expectTypeOf } from 'vitest';

import type { StorybookConfigRaw } from './core-common.ts';

type Refs = NonNullable<StorybookConfigRaw['refs']>;

// The documented shape of `refs`: https://storybook.js.org/docs/api/main-config/main-config-refs
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
