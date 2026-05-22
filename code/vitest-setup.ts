import '@testing-library/jest-dom/vitest';
import { expect, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import './core/src/shared/utils/toHaveLiveRegion.ts';
import { toHaveLiveRegion } from './core/src/shared/utils/toHaveLiveRegion.ts';

const ALLOWED_CONSOLE_PREDICATES: ((...args: any[]) => boolean)[] = [
  (message) => message.includes('":nth-child" is potentially unsafe'),
  (message) => message.includes('":first-child" is potentially unsafe'),
  (message) =>
    message.includes(
      `Support for defaultProps will be removed from function components in a future major release`
    ),
  (message) => /^Browserslist: .* Please run:/.test(message),
  (message) => message.includes('Consider adding an error boundary'),
  // React will log this error even if you catch an error with a boundary. I guess it's to
  // help in development. See https://github.com/facebook/react/issues/15069
  (message) =>
    message.includes(
      'React will try to recreate this component tree from scratch using the error boundary you provided'
    ),
  (message) => message.includes('Lit is in dev mode. Not recommended for production!'),
  (message) => message.includes('error: `DialogContent` requires a `DialogTitle`'),
  (message) =>
    message.includes(
      "importMetaResolve from within Storybook is being used in a Vitest test, but it shouldn't be. Please report this at https://github.com/storybookjs/storybook/issues/new?template=bug_report.yml"
    ),
  (message) => message.includes('<Pressable> child must forward its ref to a DOM element.'),
  (message) => message.includes('<Focusable> child must forward its ref to a DOM element.'),
  (message) => message.includes('Please ensure the tabIndex prop is passed through.'),
  // Vitest only warns about this if the import comes from a file outside of `node_modules`.
  // This only occurs locally for us and is safe to ignore.
  // It will stop once we start importing from `vitest/browser` instead (not a Vitest 3 compatible change).
  // TODO: can be removed in SB11 (when/if we remove Vitest 3 support)
  (message) => message.includes('tries to load a deprecated "@vitest/browser/context" module.'),
];

(['warn', 'error'] as const).forEach((type) => {
  const failOnConsole = vi.defineHelper((...args) => {
    if (ALLOWED_CONSOLE_PREDICATES.some((predicate) => predicate(...args))) {
      return;
    }
    expect.fail(`Unexpected console.${type} call with arguments:\n${args.join('\n')}`);
  });
  vi.spyOn(console, type).mockImplementation(failOnConsole);
});

globalThis.FEATURES ??= {};

expect.extend({
  toMatchPaths(regex: RegExp, paths: string[]) {
    const matched = paths.map((p) => !!p.match(regex));

    const pass = matched.every(Boolean);
    const failures = paths.filter((_, i) => (pass ? matched[i] : !matched[i]));
    const message = () => dedent`Expected ${regex} to ${pass ? 'not ' : ''}match all strings.
    
    Failures:${['', ...failures].join('\n - ')}`;
    return {
      pass,
      message,
    };
  },
});

expect.extend({ toHaveLiveRegion });

vi.mock('storybook/internal/node-logger', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('storybook/internal/node-logger')>()),
    prompt: {
      select: vi.fn(),
      multiSelect: vi.fn(),
      confirm: vi.fn(),
      text: vi.fn(),
      getPreferredStdio: vi.fn(),
      executeTask: vi.fn(),
      executeTaskWithSpinner: vi.fn(),
      taskLog: vi.fn(() => ({
        message: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
      })),
    },
    logger: {
      SYMBOLS: {
        success: '✓',
        error: '✗',
      },
      plain: vi.fn(),
      line: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      debug: vi.fn(),
      box: vi.fn(),
      verbose: vi.fn(),
      logBox: vi.fn(),
      intro: vi.fn(),
      outro: vi.fn(),
      step: vi.fn(),
    },
  };
});

vi.mock('./core/src/shared/utils/module.ts', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    resolvePackageDir: vi.fn().mockReturnValue('/mocked/package/dir'),
    importModule: vi.fn().mockResolvedValue({
      mocked: true,
    }),
  };
});
