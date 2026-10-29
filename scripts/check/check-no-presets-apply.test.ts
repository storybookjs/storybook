import { describe, expect, it } from 'vitest';

import { findPresetsApplyCalls } from './check-no-presets-apply.ts';

describe('findPresetsApplyCalls', () => {
  it.each([
    {
      name: 'instance hook call',
      input: { file: 'core/src/a.ts', code: "await storybook.callHook('core:docs:extend', {})" },
      expected: [],
    },
    {
      name: 'direct call',
      input: { file: 'core/src/a.ts', code: "await options.presets.apply('docs', {})" },
      expected: ['core/src/a.ts:1'],
    },
    {
      name: 'optional, generic and multi-line call',
      input: {
        file: 'lib/storybook/src/b.ts',
        code: "const a = 1;\nawait presets?.apply<Record<string, string>>('env');\nstorybook.presets\n  .apply('features');",
      },
      expected: ['lib/storybook/src/b.ts:2', 'lib/storybook/src/b.ts:3'],
    },
    {
      name: 'compat directory',
      input: {
        file: 'lib/storybook/src/storybook/compat/options.ts',
        code: "await options.presets.apply('framework')",
      },
      expected: [],
    },
    {
      name: 'compat file',
      input: { file: 'core/src/instance/legacy-hooks.ts', code: "presets.apply('core')" },
      expected: [],
    },
    {
      name: 'sibling of a compat file',
      input: { file: 'core/src/instance/legacy-hooks-extra.ts', code: "presets.apply('core')" },
      expected: ['core/src/instance/legacy-hooks-extra.ts:1'],
    },
  ])('$name', ({ input, expected }) => {
    expect(findPresetsApplyCalls([input])).toEqual(expected);
  });
});
