import 'vitest';

interface CustomMatchers<R = unknown> {
  toMatchPaths(paths: string[]): R;
}

declare module 'vitest' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
