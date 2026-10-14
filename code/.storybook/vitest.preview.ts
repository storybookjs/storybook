import type { Loader } from '@storybook/react-vite';

// Under Vitest browser mode, drive interactions through Vitest's interactivity API instead of
// storybook/test's userEvent: https://vitest.dev/guide/browser/interactivity-api.html
export const loaders: Loader[] = [
  async (context) => {
    if (!(globalThis as { __vitest_browser__?: boolean }).__vitest_browser__) {
      return;
    }
    const [{ userEvent: browserEvent }, { expect: vitestExpect }] = await Promise.all([
      import('vitest/browser'),
      import('vitest'),
    ]);
    // Unfortunately the types of userEvent don't match so we cast it
    context.userEvent = browserEvent.setup() as unknown as typeof context.userEvent;
    context.expect = vitestExpect as unknown as typeof context.expect;
  },
];
