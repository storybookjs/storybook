import { builtinModules, createRequire, syncBuiltinESMExports } from 'node:module';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import '@testing-library/jest-dom/vitest';
import { afterAll, expect, vi } from 'vitest';

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
];

// Vitest cannot tie direct stream writes (from @clack/prompts, or Node's own warnings) to a test,
// so `silent: 'passed-only'` cannot hide them. Route them through the console Vitest captures,
// keeping references from before the spies below and any test replace `console` methods.
const toConsole = (log: (...args: unknown[]) => void) =>
  new Writable({
    write(chunk: Buffer, _encoding, callback) {
      log('%s', chunk.toString().replace(/\n$/, ''));
      callback();
    },
  });
const stdout = toConsole(console.log.bind(console));
const stderr = toConsole(console.error.bind(console));
process.stdout.write = stdout.write.bind(stdout);
process.stderr.write = stderr.write.bind(stderr);

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
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
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
      shouldLog: vi.fn(() => false),
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

// With `isolate: false` a worker runs many test files, so each file undoes what it leaves behind
// before the next one imports its modules. This relies on Vitest internals.
type WorkerGlobals = {
  __vitest_worker__?: {
    config: { isolate: boolean };
    filepath: string;
    evaluatedModules: {
      idToModuleMap: Map<
        string,
        { promise?: unknown; exports?: unknown; evaluated: boolean; importers: Set<string> }
      >;
    };
  };
};
const { __vitest_worker__: worker } = globalThis as WorkerGlobals;

if (!worker) {
  throw new Error('Vitest internals changed: cannot reset test files that share a worker');
}

if (!worker.config.isolate) {
  const stateKey = Symbol.for('storybook.vitest.workerState');
  type WorkerState = {
    builtins: Map<Record<string, unknown>, Map<string, unknown>>;
    addSnapshotSerializer: typeof expect.addSnapshotSerializer;
    pendingCleanup?: (keep?: string) => void;
  };
  const workerScope = globalThis as { [stateKey]?: WorkerState };
  // `vi.mock('node:fs', { spy: true })` spies on the builtin itself, which Node's own module loader
  // reads through, so the originals are recorded before the worker's first test file runs.
  const requireBuiltin = createRequire(import.meta.url);
  const state: WorkerState = (workerScope[stateKey] ??= {
    builtins: new Map(
      builtinModules
        // `trace_events` cannot be loaded in a worker thread.
        .filter((name) => !name.startsWith('_') && name !== 'trace_events')
        .map((name) => {
          const exports = requireBuiltin(name);
          return [exports, new Map(Object.entries(exports))];
        })
    ),
    addSnapshotSerializer: expect.addSnapshotSerializer,
  });

  // Vitest cannot unregister snapshot serializers, so each one only applies to the file that added it.
  const { filepath } = worker;
  expect.addSnapshotSerializer = (plugin) =>
    state.addSnapshotSerializer.call(expect, {
      ...plugin,
      // Vitest installs a new worker state for each batch of files, so read the current one.
      test: (value) =>
        (globalThis as WorkerGlobals).__vitest_worker__?.filepath === filepath &&
        plugin.test(value),
    });

  // Vitest restores mocks and resets the mocker after each file, but leaves the modules evaluated.
  const cleanup = (keep?: string) => {
    worker.evaluatedModules.idToModuleMap.forEach((node, path) => {
      if (path !== keep && !/\/vitest\/dist\/|vitest-virtual-\w+\/dist|@vitest\/dist/.test(path)) {
        node.promise = undefined;
        node.exports = undefined;
        node.evaluated = false;
        node.importers.clear();
      }
    });
    for (const [exports, originals] of state.builtins) {
      for (const [key, original] of originals) {
        if (exports[key] !== original) {
          exports[key] = original;
        }
      }
    }
    // ESM imports of builtins only see the restored exports after a sync.
    syncBuiltinESMExports();
    // Files with the same DOM environment share its document.
    if (globalThis.document) {
      document.head.replaceChildren();
      document.body.replaceChildren();
      for (const element of [document.documentElement, document.body]) {
        for (const { name } of [...element.attributes]) {
          element.removeAttribute(name);
        }
      }
    }
    // Emotion warns when it is evaluated again while its global marker is set.
    for (const key of Object.keys(globalThis)) {
      if (key.startsWith('__EMOTION_REACT_')) {
        delete (globalThis as Record<string, unknown>)[key];
      }
    }
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  };

  // A file whose tests are all skipped or filtered out runs no hooks, so the next file cleans up
  // after it, keeping this setup file, which is being evaluated for that next file.
  state.pendingCleanup?.(fileURLToPath(import.meta.url));
  state.pendingCleanup = cleanup;
  afterAll(() => {
    state.pendingCleanup = undefined;
    cleanup();
  });
}
