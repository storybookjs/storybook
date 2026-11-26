import { describe, expectTypeOf, it } from 'vitest';

import type { ReactDocgenTypescriptOptions } from '@storybook/preset-react-webpack';
import type { PluginOptions } from '@storybook/react-docgen-typescript-plugin';

import type { ParserOptions } from 'react-docgen-typescript';

/** Compiles only when the value is assignable to `Target`, like an existing typed config would be. */
const assignable = <Target>(value: Target) => value;
declare const parserOptions: ParserOptions;
declare const pluginOptions: PluginOptions;
declare const options: ReactDocgenTypescriptOptions;

// The option type is a copy, because the plugin is an optional peer that published types must not
// import. Keep it interchangeable with the original, so existing typed configs keep compiling.
describe('react-docgen-typescript options', () => {
  it('accept the parser options of react-docgen-typescript', () => {
    expectTypeOf(assignable<ReactDocgenTypescriptOptions>(parserOptions)).toBeObject();
  });

  it('match the Webpack plugin options', () => {
    expectTypeOf(assignable<ReactDocgenTypescriptOptions>(pluginOptions)).toBeObject();
    expectTypeOf(assignable<PluginOptions>(options)).toBeObject();
  });
});
