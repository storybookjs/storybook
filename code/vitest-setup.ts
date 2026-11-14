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
// before the next one imports its modules. These hooks rely on Vitest internals.
const fileRunKey = Symbol.for('storybook.vitest.fileRun');

type WorkerGlobals = {
  __vitest_mocker__?: { reset(): void };
  __vitest_worker__?: {
    config: { isolate: boolean };
    evaluatedModules: {
      idToModuleMap: Map<
        string,
        { promise?: unknown; exports?: unknown; evaluated: boolean; importers: Set<string> }
      >;
    };
  };
};
const { __vitest_mocker__: mocker, __vitest_worker__: worker } = globalThis as WorkerGlobals;

if (!worker || !mocker) {
  throw new Error('Vitest internals changed: cannot reset test files that share a worker');
}

if (worker.config.isolate === false) {
  // `vi.mock('node:fs', { spy: true })` spies on the builtin itself, which Node's own module loader
  // reads through. The originals are recorded before the worker's first test file runs.
  const requireBuiltin = createRequire(import.meta.url);
  const builtinsKey = Symbol.for('storybook.vitest.builtinOriginals');
  const serializerKey = Symbol.for('storybook.vitest.addSnapshotSerializer');
  const pendingResetKey = Symbol.for('storybook.vitest.pendingReset');
  const workerScope = globalThis as {
    [builtinsKey]?: Map<Record<string, unknown>, Map<string, unknown>>;
    [fileRunKey]?: number;
    [pendingResetKey]?: () => void;
    [serializerKey]?: typeof expect.addSnapshotSerializer;
  };
  workerScope[builtinsKey] ??= new Map(
    builtinModules
      // `trace_events` cannot be loaded in a worker thread.
      .filter(
        (name) => !name.startsWith('_') && !name.includes('internal') && name !== 'trace_events'
      )
      .map((name) => {
        const exports = requireBuiltin(name.startsWith('node:') ? name : `node:${name}`);
        return [exports, new Map(Object.keys(exports).map((key) => [key, exports[key]]))];
      })
  );

  // Like Vitest between isolated files: `vi.resetModules()` alone would keep mocked modules.
  const resetModules = (keep?: string) =>
    worker.evaluatedModules.idToModuleMap.forEach((node, path) => {
      if (path !== keep && !/\/vitest\/dist\/|vitest-virtual-\w+\/dist|@vitest\/dist/.test(path)) {
        node.promise = undefined;
        node.exports = undefined;
        node.evaluated = false;
        node.importers.clear();
      }
    });
  const restoreBuiltins = () => {
    for (const [exports, originals] of workerScope[builtinsKey]!) {
      for (const [key, original] of originals) {
        if (exports[key] !== original) {
          exports[key] = original;
        }
      }
    }
    // ESM imports of builtins only see the restored exports after a sync.
    syncBuiltinESMExports();
  };

  // Vitest runs no hooks for a file whose tests are all skipped or filtered out, so the next file
  // resets what it loaded. This setup file is being evaluated for that next file, so it is kept.
  workerScope[pendingResetKey]?.();
  workerScope[pendingResetKey] = () => {
    resetModules(fileURLToPath(import.meta.url));
    restoreBuiltins();
  };

  // Vitest cannot unregister snapshot serializers, so each one only applies to the file that added it.
  const fileRun = (workerScope[fileRunKey] = (workerScope[fileRunKey] ?? 0) + 1);
  const addSnapshotSerializer = (workerScope[serializerKey] ??= expect.addSnapshotSerializer);
  expect.addSnapshotSerializer = (plugin) =>
    addSnapshotSerializer.call(expect, {
      ...plugin,
      test: (value) => workerScope[fileRunKey] === fileRun && plugin.test(value),
    });

  afterAll(() => {
    delete workerScope[pendingResetKey];
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
    mocker.reset();
    resetModules();
    restoreBuiltins();
    // Emotion warns when it is evaluated again while its global marker is set.
    for (const key of Object.keys(globalThis)) {
      if (key.startsWith('__EMOTION_REACT_')) {
        delete (globalThis as Record<string, unknown>)[key];
      }
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
}
