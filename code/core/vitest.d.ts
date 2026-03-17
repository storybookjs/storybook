import 'vite-plus/test';

interface CustomMatchers<R = unknown> {
  toMatchPaths(paths: string[]): R;
}

declare module 'vite-plus/test' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
