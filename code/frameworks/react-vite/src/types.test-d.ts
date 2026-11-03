import { describe, expectTypeOf, it } from 'vitest';

import type vitePlugin from '@joshwooding/vite-plugin-react-docgen-typescript';
import type { ParserOptions } from 'react-docgen-typescript';

import type { ReactDocgenTypescriptOptions } from './types.ts';

/** Compiles only when `Source` is assignable to `Target`, like an existing typed config would be. */
const assignable = <Target>(value: Target) => value;
declare const parserOptions: ParserOptions;
declare const options: ReactDocgenTypescriptOptions;

// The option types are copies, because the plugins are optional peers that published types must not
// import. Keep them interchangeable with the originals, so existing typed configs keep compiling.
describe('react-docgen-typescript options', () => {
  it('accept the parser options of react-docgen-typescript', () => {
    expectTypeOf(assignable<ReactDocgenTypescriptOptions>(parserOptions)).toBeObject();
  });

  it('can be passed to the Vite plugin', () => {
    // Fails to compile when no overload of the installed plugin accepts the options.
    const createPlugin = (value: ReactDocgenTypescriptOptions): ReturnType<typeof vitePlugin> =>
      (null as unknown as typeof vitePlugin)(value);
    expectTypeOf(createPlugin(options)).not.toBeNever();
  });
});
