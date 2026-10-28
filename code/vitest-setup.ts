import '@testing-library/jest-dom/vitest';
import { expect, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import './core/src/utils/toHaveLiveRegion.ts';
import { toHaveLiveRegion } from './core/src/utils/toHaveLiveRegion.ts';

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

vi.mock('storybook/internal/node-logger', async (importOriginal) =>
  (await import('./vitest.node-logger-mock.ts')).mockNodeLogger(importOriginal)
);
// Node-side framework, renderer and builder code imports the logger from `@storybook/core`.
vi.mock('@storybook/core/internal/node-logger', async (importOriginal) =>
  (await import('./vitest.node-logger-mock.ts')).mockNodeLogger(importOriginal)
);
