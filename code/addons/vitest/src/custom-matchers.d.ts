import 'storybook/test';

declare module 'storybook/test' {
  interface Assertion<T> {
    toHaveLiveRegion(options: {
      text: string | RegExp;
      level?: 'polite' | 'assertive';
    }): Promise<void>;
  }
}
