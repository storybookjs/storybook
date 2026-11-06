// loader-utils 3 ships no types, and @types/loader-utils targets webpack 4.
declare module 'loader-utils' {
  import type { LoaderContext } from 'webpack';

  export function interpolateName(
    loaderContext: LoaderContext<unknown>,
    name: string | ((resourcePath: string, resourceQuery?: string) => string),
    options?: { context?: string; content?: string | Buffer; regExp?: string | RegExp }
  ): string;
}
