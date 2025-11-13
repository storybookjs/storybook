import '@testing-library/jest-dom/vitest';
import { expect, vi } from 'vitest';

import { dedent } from 'ts-dedent';

const ignoreList = [
  (error: any) => error.message.includes('":nth-child" is potentially unsafe'),
  (error: any) => error.message.includes('":first-child" is potentially unsafe'),
  (error: any) =>
    error.message.match(
      `Support for defaultProps will be removed from function components in a future major release`
    ),
  (error: any) => error.message.match(/Browserslist: .* is outdated. Please run:/),
  (error: any) => error.message.includes('Consider adding an error boundary'),
  (error: any) =>
    error.message.includes('react-async-component-lifecycle-hooks') &&
    error.stack.includes('addons/knobs/src/components/__tests__/Options.js'),
  // React will log this error even if you catch an error with a boundary. I guess it's to
  // help in development. See https://github.com/facebook/react/issues/15069
  (error: any) =>
    error.message.match(
      /React will try to recreate this component tree from scratch using the error boundary you provided/
    ),
  (error: any) => error.message.includes('Lit is in dev mode. Not recommended for production!'),
  (error: any) => error.message.includes('error: `DialogContent` requires a `DialogTitle`'),
  (error: any) =>
    error.message.includes(
      "importMetaResolve from within Storybook is being used in a Vitest test, but it shouldn't be. Please report this at https://github.com/storybookjs/storybook/issues/new?template=bug_report.yml"
    ),
  (error: any) =>
    error.message.includes('<Pressable> child must forward its ref to a DOM element.'),
  (error: any) =>
    error.message.includes('<Focusable> child must forward its ref to a DOM element.'),
];

const throwMessage = (type: any, message: any) => {
  // eslint-disable-next-line local-rules/no-uncategorized-errors
  const error = new Error(`${type}${message}`);
  if (!ignoreList.reduce((acc, item) => acc || item(error), false)) {
    throw error;
  }
};
const throwWarning = (message: any) => throwMessage('warn: ', message);
const throwError = (message: any) => throwMessage('error: ', message);

globalThis.FEATURES ??= {};

vi.spyOn(console, 'warn').mockImplementation(throwWarning);
vi.spyOn(console, 'error').mockImplementation(throwError);

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
