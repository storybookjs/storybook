import { expect, it } from 'vitest';

import { findUnbuiltDeepSpecifiers, getBuiltDeepSpecifiers } from './check-deep-imports.ts';

const BUILT = new Set([
  '@storybook/core/internal/deep/constants/tags',
  '@storybook/manager/internal/deep/builder-manager',
]);

it.each([
  {
    name: 'built entry',
    input: `import { Tag } from '@storybook/core/internal/deep/constants/tags';`,
    expected: [],
  },
  {
    name: 'source file without an entry',
    input: `import { x } from '@storybook/core/internal/deep/constants/extensions';`,
    expected: ['@storybook/core/internal/deep/constants/extensions'],
  },
  {
    name: 'mocked and type-only uses',
    input: [
      `vi.mock("@storybook/core/internal/deep/utils/other", () => ({}));`,
      'type T = typeof import(`@storybook/ui/internal/deep/components/x`);',
    ].join('\n'),
    expected: [
      '@storybook/core/internal/deep/utils/other',
      '@storybook/ui/internal/deep/components/x',
    ],
  },
  {
    name: 'other specifiers',
    input: [
      `import { a } from '@storybook/core/internal/types';`,
      `import { b } from 'storybook/internal/deep/x';`,
      `import { c } from '../../core/src/instance/hooks.ts';`,
    ].join('\n'),
    expected: [],
  },
])('$name', ({ input, expected }) => {
  expect(findUnbuiltDeepSpecifiers(input, BUILT)).toEqual(expected);
});

it('reads the built deep specifiers from the build configs', async () => {
  const built = await getBuiltDeepSpecifiers();

  expect(built.has('@storybook/core/internal/deep/constants/tags')).toBe(true);
  expect(built.has('@storybook/manager/internal/deep/builder-manager')).toBe(true);
  expect(built.has('@storybook/core/internal/types')).toBe(false);
});
