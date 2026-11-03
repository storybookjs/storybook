import { describe, expectTypeOf, it } from 'vitest';

import type { ReactDocgenTypescriptOptions } from '@storybook/preset-react-webpack';
import type { PluginOptions } from '@storybook/react-docgen-typescript-plugin';

import type { ParserOptions } from 'react-docgen-typescript';

// The option type is a copy, because the plugin is an optional peer that published types must not
// import. Keep it interchangeable with the original, so existing typed configs keep compiling.
describe('react-docgen-typescript options', () => {
  it('accept the parser options of react-docgen-typescript', () => {
    expectTypeOf<ParserOptions>().toExtend<ReactDocgenTypescriptOptions>();
  });

  it('match the Webpack plugin options', () => {
    expectTypeOf<PluginOptions>().toExtend<ReactDocgenTypescriptOptions>();
    expectTypeOf<ReactDocgenTypescriptOptions>().toExtend<PluginOptions>();
  });
});
