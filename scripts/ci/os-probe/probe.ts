/**
 * Vitest setup file that records which test files reach an OS-dependent API from repository code.
 * Enabled by `STORYBOOK_OS_PROBE_DIR`; each test file writes one JSON record into that directory.
 */
import { createHash } from 'node:crypto';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

import { afterAll, beforeAll, expect } from 'vitest';

type Hit = { api: string; frame: string };
type ProbeState = {
  file: string | undefined;
  /** `load` while Vitest imports the test file, `run` once its hooks and tests run. */
  phase: 'load' | 'run';
  hits: Map<string, Hit[]>;
};

const STATE = Symbol.for('storybook.os-probe');
const MAX_HITS_PER_FILE = 5;
const repoRoot = path.posix.resolve(import.meta.dirname, '../../..');
// Relative to the repository root: projects and tests may run from another directory.
const outDir =
  process.env.STORYBOOK_OS_PROBE_DIR &&
  path.posix.resolve(repoRoot, process.env.STORYBOOK_OS_PROBE_DIR);
const ownFiles = new Set([import.meta.filename]);

const isRepoSource = (file: string) =>
  file.startsWith(repoRoot) &&
  !file.includes('/node_modules/') &&
  !file.endsWith('/vitest-setup.ts') &&
  !ownFiles.has(file);

// The module runner resolves imports with `path`; those calls reach no test assertion.
const TEST_INFRA = /\/node_modules\/(vitest|@vitest\/[^/]+|vite|tinypool)\//;

type Frame = { file: string; line: number | null };

/**
 * The repository frames on the stack, nearest first, skipping this probe and third-party code.
 * The walk stops at Vitest's own machinery, so a call it makes before any repository frame has
 * none.
 */
const findRepoFrames = (): Frame[] => {
  const { prepareStackTrace, stackTraceLimit } = Error;
  Error.stackTraceLimit = 25;
  Error.prepareStackTrace = (_, callSites) => callSites;
  const holder: { stack?: NodeJS.CallSite[] } = {};
  Error.captureStackTrace(holder, findRepoFrames);
  const callSites = holder.stack ?? [];
  Error.prepareStackTrace = prepareStackTrace;
  Error.stackTraceLimit = stackTraceLimit;

  const frames: Frame[] = [];
  for (const site of callSites) {
    let file = site.getFileName();
    if (!file) {
      continue;
    }
    if (file.startsWith('file://')) {
      file = file.slice('file://'.length);
    }
    if (TEST_INFRA.test(file)) {
      break;
    }
    if (isRepoSource(file)) {
      frames.push({ file, line: site.getLineNumber() });
    }
  }
  return frames;
};

const getState = (): ProbeState => {
  const scope = globalThis as { [STATE]?: ProbeState };
  if (!scope[STATE]) {
    scope[STATE] = { file: undefined, phase: 'load', hits: new Map() };
    installTraps(scope[STATE]);
  }
  return scope[STATE];
};

function installTraps(state: ProbeState) {
  let busy = false;
  const record = (api: string) => {
    const { file } = state;
    if (busy || !file) {
      return;
    }
    const hits = state.hits.get(file) ?? [];
    if (hits.length >= MAX_HITS_PER_FILE) {
      return;
    }
    busy = true;
    try {
      const frames = findRepoFrames();
      const [frame] = frames;
      // Imported modules compute constants such as a cache path at load time. While the test file
      // loads, only calls it makes, directly or through repository code, count; once hooks and
      // tests run, every call does.
      const counts =
        frame && (state.phase === 'run' || frames.some((candidate) => candidate.file === file));
      if (counts && !hits.some((hit) => hit.api === api)) {
        hits.push({ api, frame: `${frame.file.slice(repoRoot.length + 1)}:${frame.line}` });
        state.hits.set(file, hits);
      }
    } finally {
      busy = false;
    }
  };

  const wrapMethods = (target: Record<string, unknown>, label: string, names: string[]) => {
    for (const name of names) {
      const original = target[name];
      if (typeof original !== 'function') {
        continue;
      }
      const wrapper = function (this: unknown, ...args: unknown[]) {
        record(`${label}.${name}`);
        return original.apply(this, args);
      };
      // Keep extras such as `realpathSync.native` and `exec[util.promisify.custom]`.
      for (const key of Reflect.ownKeys(original)) {
        if (!Object.hasOwn(wrapper, key)) {
          Object.defineProperty(wrapper, key, Object.getOwnPropertyDescriptor(original, key)!);
        }
      }
      target[name] = wrapper;
    }
  };

  const wrapGetter = (target: object, name: string, label: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    if (!descriptor) {
      return;
    }
    const read = descriptor.get ? descriptor.get.bind(target) : () => descriptor.value;
    Object.defineProperty(target, name, {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() {
        record(label);
        return read();
      },
      set(value) {
        Object.defineProperty(target, name, {
          configurable: true,
          enumerable: descriptor.enumerable,
          writable: true,
          value,
        });
      },
    });
  };

  // On POSIX `path` and `path.posix` are the same object. Explicit `path.posix` / `path.win32` calls
  // behave the same everywhere, so they get an untouched copy before `path` is wrapped.
  const posixCopy = { ...path.posix };
  const pathFunctions = Object.keys(path).filter(
    (key) => typeof (path as unknown as Record<string, unknown>)[key] === 'function'
  );
  wrapMethods(path as unknown as Record<string, unknown>, 'path', pathFunctions);
  wrapGetter(path, 'sep', 'path.sep');
  wrapGetter(path, 'delimiter', 'path.delimiter');
  (path as { posix: unknown }).posix = posixCopy;
  (posixCopy as { posix: unknown }).posix = posixCopy;

  wrapMethods(os as unknown as Record<string, unknown>, 'os', [
    'tmpdir',
    'homedir',
    'platform',
    'type',
    'userInfo',
  ]);
  wrapGetter(os, 'EOL', 'os.EOL');
  wrapMethods(url as unknown as Record<string, unknown>, 'url', ['fileURLToPath', 'pathToFileURL']);
  wrapMethods(fs as unknown as Record<string, unknown>, 'fs', [
    'realpath',
    'realpathSync',
    'mkdtemp',
    'mkdtempSync',
  ]);
  wrapMethods(fs.promises as unknown as Record<string, unknown>, 'fs.promises', [
    'realpath',
    'mkdtemp',
  ]);
  wrapMethods(childProcess as unknown as Record<string, unknown>, 'child_process', [
    'spawn',
    'spawnSync',
    'exec',
    'execSync',
    'execFile',
    'execFileSync',
    'fork',
  ]);
  wrapMethods(process as unknown as Record<string, unknown>, 'process', ['cwd', 'chdir']);
  wrapGetter(process, 'platform', 'process.platform');

  // Named ESM imports of builtins only see the wrappers after this.
  syncBuiltinESMExports();
}

const hasFailed = (task: { result?: { state?: string }; tasks?: unknown[] }): boolean =>
  task.result?.state === 'fail' ||
  (task.tasks ?? []).some((child) => hasFailed(child as Parameters<typeof hasFailed>[0]));

if (outDir) {
  const state = getState();
  const file = expect.getState().testPath;
  state.file = file;
  state.phase = 'load';
  beforeAll(() => {
    state.phase = 'run';
  });

  // Vitest passes the file's suite as the second argument.
  afterAll(async ({}, suite) => {
    if (!file) {
      return;
    }
    // Plain string work: the test may have mocked `path`.
    const relative = file.slice(repoRoot.length + 1);
    const hits = state.hits.get(file) ?? [];
    state.hits.delete(file);
    // A test that failed may have stopped before it reached an OS-dependent call.
    if (hasFailed(suite)) {
      hits.unshift({ api: 'failed on Linux', frame: relative });
    }
    const name = createHash('sha1').update(relative).digest('hex');
    await mkdir(outDir, { recursive: true });
    await writeFile(`${outDir}/${name}.json`, JSON.stringify({ file: relative, hits }));
  });
}
