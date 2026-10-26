import type { TSESLint } from '@typescript-eslint/utils';
import type { Linter } from 'eslint-v9';
import { defineConfig } from 'eslint-v9/config';
import { expectTypeOf, test } from 'vitest';

import storybook from '../index.ts';

type FlatConfigKey = Extract<keyof typeof storybook.configs, `flat/${string}`>;

test('flat configs are assignable to ESLint 9 Linter.Config[] and typescript-eslint FlatConfig.Config[]', () => {
  type AllFlatConfigs = (typeof storybook.configs)[FlatConfigKey];

  expectTypeOf<AllFlatConfigs>().toExtend<Linter.Config[]>();
  expectTypeOf<AllFlatConfigs>().toExtend<TSESLint.FlatConfig.Config[]>();

  const flatKeys = Object.keys(storybook.configs).filter((key): key is FlatConfigKey =>
    key.startsWith('flat/')
  );

  for (const key of flatKeys) {
    const config = storybook.configs[key];
    expectTypeOf(config).toExtend<Linter.Config[]>();
    expectTypeOf(config).toExtend<TSESLint.FlatConfig.Config[]>();
  }
});

test('flat configs satisfy ESLint 9 defineConfig and assignment patterns', () => {
  defineConfig({ extends: [storybook.configs['flat/recommended']] });

  const c: Linter.Config[] = storybook.configs['flat/csf-strict'];
  expectTypeOf(c).toEqualTypeOf<Linter.Config[]>();

  defineConfig([...storybook.configs['flat/recommended'], { rules: {} }]);
});
