import { EventEmitter } from 'node:events';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PassThrough } from 'node:stream';

import { logger } from 'storybook/internal/node-logger';

import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCompodocCommandArgs, runCompodoc } from '../builders/utils/run-compodoc.ts';
import { readCompodocOutputDir } from '../compodoc-config.ts';
import {
  buildCompodocWatchArgs,
  COMPODOC_WATCH_PROTOCOL,
  COMPODOC_WATCH_PROTOCOL_VERSION,
  compodocWatchPlugin,
  createCompodocWatch,
  isCompodocWatchEvent,
  resolveCompodocCli,
  terminateWatchChildren,
  type CompodocWatchEvent,
  type CreateCompodocWatchOptions,
} from './compodoc-watch-plugin.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('../builders/utils/run-compodoc.ts', { spy: true });
// Only `existsSync` is redirected: the CLI-resolution test below reads the real installed package.
vi.mock('node:fs', { spy: true });

const INITIAL_COMPLETE = {
  protocol: COMPODOC_WATCH_PROTOCOL,
  version: COMPODOC_WATCH_PROTOCOL_VERSION,
  type: 'watch-cycle',
  state: 'complete',
  invalidation: 'global',
  cycle: 1,
  trigger: { kind: 'initial' },
  output: { format: 'json', path: '/workspace/documentation.json' },
  durationMs: 10,
} satisfies CompodocWatchEvent;

const CAPABILITY = {
  protocol: COMPODOC_WATCH_PROTOCOL,
  version: COMPODOC_WATCH_PROTOCOL_VERSION,
  type: 'watch-capability',
  capabilities: { cycles: true, gracefulClose: true },
} satisfies CompodocWatchEvent;

const completion = (
  cycle: number,
  path = '/workspace/src/button.component.ts',
  invalidation: 'files' | 'global' = 'files'
) =>
  ({
    protocol: COMPODOC_WATCH_PROTOCOL,
    version: COMPODOC_WATCH_PROTOCOL_VERSION,
    type: 'watch-cycle',
    state: 'complete',
    invalidation,
    cycle,
    trigger: { kind: 'changes', changes: [{ kind: 'change', path }] },
    output: { format: 'json', path: '/workspace/documentation.json' },
    durationMs: 5,
  }) satisfies CompodocWatchEvent;

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  connected = true;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  sent: unknown[] = [];
  kill = vi.fn((signal: NodeJS.Signals) => {
    this.signalCode = signal;
    this.connected = false;
    this.emit('exit', null, signal);
    return true;
  });
  send = vi.fn((message: unknown) => {
    this.sent.push(message);
    return true;
  });
}

const emitCapability = (child: FakeChild) => child.emit('message', CAPABILITY);
const completeInitial = (child: FakeChild) => {
  vol.fromNestedJSON({ '/workspace/documentation.json': '{}' });
  emitCapability(child);
  child.emit('message', INITIAL_COMPLETE);
};

const baseOptions = () => ({
  workspaceRoot: '/workspace',
  outputDir: '/workspace',
  tsconfig: '/workspace/tsconfig.json',
  compodocArgs: ['-e', 'json', '-d', '.'],
  resolveCli: () => ({
    cliPath: '/compodoc/bin/index-cli.js',
    packagePath: '/compodoc/package.json',
    version: '2.0.0-local',
  }),
});

const create = (overrides: Record<string, unknown> = {}) => {
  const child = new FakeChild();
  const refresh = vi.fn(async () => undefined);
  let generation = 0;
  const controller = createCompodocWatch({
    ...baseOptions(),
    spawn: () => child as any,
    refresh,
    initialTimeoutMs: 50,
    closeTimeoutMs: 5,
    nextGeneration: () => ++generation,
    ...overrides,
  });
  return { child, refresh, controller };
};

beforeEach(async () => {
  vi.clearAllMocks();
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  const realFs = await vi.importActual<typeof import('node:fs')>('node:fs');
  vi.mocked(existsSync).mockImplementation(memfs.fs.existsSync as typeof existsSync);
  vi.mocked(readFileSync).mockImplementation(((
    file: Parameters<typeof readFileSync>[0],
    options?: any
  ) =>
    typeof file === 'string' && file.startsWith('/workspace')
      ? memfs.fs.readFileSync(file, options)
      : realFs.readFileSync(file, options)) as typeof readFileSync);
  vi.mocked(renameSync).mockImplementation(((
    from: Parameters<typeof renameSync>[0],
    to: Parameters<typeof renameSync>[1]
  ) =>
    typeof from === 'string' && from.startsWith('/workspace')
      ? memfs.fs.renameSync(from, to)
      : realFs.renameSync(from, to)) as typeof renameSync);
  vi.mocked(rmSync).mockImplementation(((
    target: Parameters<typeof rmSync>[0],
    options?: Parameters<typeof rmSync>[1]
  ) =>
    typeof target === 'string' && target.startsWith('/workspace')
      ? memfs.fs.rmSync(target, options as any)
      : realFs.rmSync(target, options)) as typeof rmSync);
  vi.mocked(writeFileSync).mockImplementation(((
    file: Parameters<typeof writeFileSync>[0],
    data: any,
    options?: any
  ) =>
    typeof file === 'string' && file.startsWith('/workspace')
      ? memfs.fs.writeFileSync(file, data, options)
      : realFs.writeFileSync(file, data, options)) as typeof writeFileSync);
  vi.mocked(runCompodoc).mockImplementation(async () => {
    vol.fromNestedJSON({ '/workspace/documentation.json': '{"fresh":true}' });
  });
});

afterEach(() => {
  // Children a test left running are still registered for process-level teardown.
  terminateWatchChildren();
});

describe('Compodoc watch protocol', () => {
  it('validates the versioned fixtures and rejects malformed or mismatched messages', () => {
    expect(isCompodocWatchEvent(INITIAL_COMPLETE)).toBe(true);
    expect(isCompodocWatchEvent(CAPABILITY)).toBe(true);
    expect(isCompodocWatchEvent(completion(2))).toBe(true);
    expect(isCompodocWatchEvent({ ...INITIAL_COMPLETE, version: 2 })).toBe(false);
    expect(isCompodocWatchEvent({ ...INITIAL_COMPLETE, cycle: '1' })).toBe(false);
    expect(isCompodocWatchEvent({ ...INITIAL_COMPLETE, invalidation: undefined })).toBe(false);
    expect(
      isCompodocWatchEvent({
        ...completion(2),
        trigger: { kind: 'changes', changes: [{ kind: 'moved', path: '/x' }] },
      })
    ).toBe(false);
  });

  it('builds watch arguments from the one-shot command and strips finite command ownership', () => {
    expect(
      buildCompodocWatchArgs({
        workspaceRoot: '/workspace',
        tsconfig: 'tsconfig.json',
        compodocArgs: [
          '-e=html',
          '--exportFormat=html',
          '-s',
          '--coverageTest',
          '80',
          '--files=src/button.ts',
        ],
      })
    ).toEqual(['-p', 'tsconfig.json', '-d', '/workspace', '-e', 'json', '--watch']);
  });

  it('normalizes combined short flags and attached short output/export values', () => {
    expect(readCompodocOutputDir(['-dcustom-output'])).toBe('custom-output');
    expect(
      buildCompodocWatchArgs({
        workspaceRoot: '/workspace',
        tsconfig: 'tsconfig.json',
        compodocArgs: ['-sw', '-dcustom-output', '-ehtml'],
      })
    ).toEqual(['-p', 'tsconfig.json', '-d', 'custom-output', '-e', 'json', '--watch']);
    expect(
      buildCompodocWatchArgs({
        workspaceRoot: '/workspace',
        tsconfig: 'tsconfig.json',
        compodocArgs: ['-ws', '-tdcustom'],
      })
    ).toEqual(['-p', 'tsconfig.json', '-t', '-d', 'custom', '-e', 'json', '--watch']);
  });

  it('inserts owned watch options before the positional-argument terminator', () => {
    expect(
      buildCompodocWatchArgs({
        workspaceRoot: '/workspace',
        tsconfig: 'tsconfig.json',
        compodocArgs: ['--', '--watch', '-e', 'html', '-d', 'positional-output'],
      })
    ).toEqual([
      '-p',
      'tsconfig.json',
      '-d',
      '/workspace',
      '-e',
      'json',
      '--watch',
      '--',
      '--watch',
      '-e',
      'html',
      '-d',
      'positional-output',
    ]);
  });

  it('relativizes an absolute tsconfig against the command workspace', () => {
    expect(
      buildCompodocCommandArgs({
        workspaceRoot: '/workspace',
        tsconfig: '/workspace/projects/example/tsconfig.json',
        compodocArgs: [],
      })
    ).toEqual(['compodoc', '-p', 'projects/example/tsconfig.json', '-d', '/workspace']);
  });

  it('resolves the installed package binary from the project rather than assuming node_modules', () => {
    const resolved = resolveCompodocCli(resolve(import.meta.dirname, '../..'));
    const packageJson = JSON.parse(readFileSync(resolved.packagePath, 'utf8')) as {
      version: string;
      bin: { compodoc: string };
    };

    expect(resolved.version).toBe(packageJson.version);
    expect(resolved.cliPath).toBe(resolve(dirname(resolved.packagePath), packageJson.bin.compodoc));
  });
});

describe('createCompodocWatch', () => {
  it('waits for the initial complete event without trying to refresh an unregistered service', async () => {
    const { child, refresh, controller } = create();
    completeInitial(child);

    await expect(controller.ready).resolves.toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ['non-JSON format', { output: { format: 'html', path: '/workspace/documentation.json' } }],
    ['different output', { output: { format: 'json', path: '/workspace/other.json' } }],
  ])('rejects initial readiness for a %s completion', async (_name, override) => {
    const { child, controller } = create();
    vol.fromNestedJSON({ '/workspace/documentation.json': '{}' });
    emitCapability(child);
    child.emit('message', { ...INITIAL_COMPLETE, ...override });

    await expect(controller.ready).rejects.toThrow('unexpected output');
    await controller.close();
  });

  it('ignores malformed messages and still accepts a later valid initial completion', async () => {
    const { child, controller } = create();
    child.emit('message', { protocol: COMPODOC_WATCH_PROTOCOL, version: 99 });
    completeInitial(child);

    await expect(controller.ready).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      '[storybook-angular-vite] ignored malformed Compodoc watch IPC message'
    );
  });

  it('forwards two later completions and coalesces a duplicate generation', async () => {
    const { child, refresh, controller } = create();
    completeInitial(child);
    await controller.ready;

    child.emit('message', completion(2));
    child.emit('message', completion(2));
    child.emit('message', completion(3, '/workspace/src/card.component.ts'));

    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    expect(refresh).toHaveBeenNthCalledWith(1, {
      files: ['/workspace/src/button.component.ts'],
      generation: 2,
      invalidation: 'files',
    });
    expect(refresh).toHaveBeenNthCalledWith(2, {
      files: ['/workspace/src/card.component.ts'],
      generation: 3,
      invalidation: 'files',
    });
  });

  it('keeps generation watermarks monotonic across replacement watch children', async () => {
    const firstChild = new FakeChild();
    const secondChild = new FakeChild();
    const firstRefresh = vi.fn<NonNullable<CreateCompodocWatchOptions['refresh']>>(
      async () => undefined
    );
    const secondRefresh = vi.fn<NonNullable<CreateCompodocWatchOptions['refresh']>>(
      async () => undefined
    );
    const first = createCompodocWatch({
      ...baseOptions(),
      spawn: () => firstChild as any,
      refresh: firstRefresh,
    });
    completeInitial(firstChild);
    firstChild.emit('message', completion(2));
    await vi.waitFor(() => expect(firstRefresh).toHaveBeenCalledOnce());
    await first.close();

    const second = createCompodocWatch({
      ...baseOptions(),
      spawn: () => secondChild as any,
      refresh: secondRefresh,
    });
    completeInitial(secondChild);
    secondChild.emit('message', completion(2));
    await vi.waitFor(() => expect(secondRefresh).toHaveBeenCalledOnce());
    await second.close();

    expect(secondRefresh.mock.calls[0][0].generation).toBeGreaterThan(
      firstRefresh.mock.calls[0][0].generation
    );
  });

  it('forwards global invalidation even when no changed file maps to a story', async () => {
    const { child, refresh, controller } = create();
    completeInitial(child);
    await controller.ready;

    child.emit('message', completion(2, '/workspace/tsconfig.json', 'global'));

    await vi.waitFor(() =>
      expect(refresh).toHaveBeenCalledWith({
        files: ['/workspace/tsconfig.json'],
        generation: 2,
        invalidation: 'global',
      })
    );
  });

  it('diagnoses a later completion when core/docgen is not registered', async () => {
    const child = new FakeChild();
    const controller = createCompodocWatch({
      ...baseOptions(),
      spawn: () => child as any,
      initialTimeoutMs: 50,
      closeTimeoutMs: 1,
    });
    completeInitial(child);
    await controller.ready;

    child.emit('message', completion(2));

    await vi.waitFor(() =>
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('core/docgen could not be refreshed')
      )
    );
    await controller.close();
  });

  it('rejects initial readiness on an error, disconnect, or exit', async () => {
    const errored = create();
    emitCapability(errored.child);
    errored.child.emit('message', {
      protocol: COMPODOC_WATCH_PROTOCOL,
      version: COMPODOC_WATCH_PROTOCOL_VERSION,
      type: 'watch-cycle',
      state: 'error',
      cycle: 1,
      trigger: { kind: 'initial' },
      error: { name: 'GenerationError', message: 'failed' },
    } satisfies CompodocWatchEvent);
    await expect(errored.controller.ready).rejects.toThrow('failed');

    const disconnected = create();
    disconnected.child.emit('disconnect');
    await expect(disconnected.controller.ready).rejects.toThrow('disconnected');

    const exited = create();
    exited.child.emit('exit', 1, null);
    await expect(exited.controller.ready).rejects.toThrow('exited');
  });

  it('acknowledges idempotent shutdown without sending a second close', async () => {
    const { child, controller } = create();
    completeInitial(child);
    await controller.ready;

    const first = controller.close();
    const second = controller.close();
    expect(first).toBe(second);
    expect(child.sent).toEqual([
      {
        protocol: COMPODOC_WATCH_PROTOCOL,
        version: COMPODOC_WATCH_PROTOCOL_VERSION,
        type: 'watch-close',
      },
    ]);
    child.emit('message', {
      protocol: COMPODOC_WATCH_PROTOCOL,
      version: COMPODOC_WATCH_PROTOCOL_VERSION,
      type: 'watch-closed',
    } satisfies CompodocWatchEvent);
    child.connected = false;
    child.exitCode = 0;
    child.emit('exit', 0, null);
    await first;
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('falls back to SIGTERM when shutdown is not acknowledged', async () => {
    const { child, controller } = create();
    completeInitial(child);
    await controller.ready;

    await controller.close();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('still tears down when the IPC channel closes during watch-close send', async () => {
    const { child, controller } = create({ closeTimeoutMs: 1 });
    completeInitial(child);
    await controller.ready;
    child.send = vi.fn(() => {
      throw new Error('channel closed');
    });

    await controller.close();

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('watch-close IPC send failed')
    );
  });

  it('gives up on a Compodoc that never speaks the protocol, well before the cycle timeout', async () => {
    const { controller } = create({ handshakeTimeoutMs: 1, initialTimeoutMs: 60_000 });

    await expect(controller.ready).rejects.toThrow(
      /Compodoc 2\.0\.0-local reported no watch capability within 1ms/
    );
  });

  it('waits for the full initial cycle once the child has proven it speaks the protocol', async () => {
    const { child, controller } = create({ handshakeTimeoutMs: 20, initialTimeoutMs: 60_000 });
    emitCapability(child);
    child.emit('message', {
      protocol: COMPODOC_WATCH_PROTOCOL,
      version: COMPODOC_WATCH_PROTOCOL_VERSION,
      type: 'watch-cycle',
      state: 'start',
      cycle: 1,
      trigger: { kind: 'initial' },
    } satisfies CompodocWatchEvent);

    await new Promise((done) => setTimeout(done, 40));
    vol.fromNestedJSON({ '/workspace/documentation.json': '{}' });
    child.emit('message', INITIAL_COMPLETE);

    await expect(controller.ready).resolves.toBeUndefined();
  });

  it('keeps the graceful shutdown window when the child only drops its IPC channel', async () => {
    const { child, controller } = create({ closeTimeoutMs: 1 });
    completeInitial(child);
    await controller.ready;
    // A dropped IPC channel says nothing about the process: it is still running and still able to
    // exit on its own within the grace period.
    child.connected = false;
    child.emit('disconnect');

    const closed = controller.close();
    setTimeout(() => {
      child.exitCode = 0;
      child.emit('exit', 0, null);
    }, 20);
    await closed;

    expect(child.kill).not.toHaveBeenCalled();
  });

  it('terminates a still-running child when the process is torn down without Vite', async () => {
    const { child } = create();
    completeInitial(child);

    terminateWatchChildren();

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('force-kills a process-teardown child that ignores SIGTERM', () => {
    const { child } = create();
    child.kill = vi.fn(() => true);
    completeInitial(child);

    terminateWatchChildren();

    expect(child.kill.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGKILL']);
  });

  it('leaves an already closed child alone on process teardown', async () => {
    const { child, controller } = create({ closeTimeoutMs: 1 });
    completeInitial(child);
    await controller.ready;
    await controller.close();
    child.kill.mockClear();

    terminateWatchChildren();

    expect(child.kill).not.toHaveBeenCalled();
  });

  it('rejects startup on timeout and closes the child', async () => {
    const { child, controller } = create({ initialTimeoutMs: 1 });
    emitCapability(child);

    await expect(controller.ready).rejects.toThrow('initial watch cycle timed out');
    await controller.close();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('retains custody when an unresponsive child survives SIGTERM and SIGKILL', async () => {
    const { child, controller } = create({ closeTimeoutMs: 1 });
    child.kill = vi.fn(() => true);
    completeInitial(child);
    await controller.ready;

    await expect(controller.close()).rejects.toThrow('did not exit after SIGTERM and SIGKILL');

    expect(child.kill.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGKILL']);
    child.kill.mockClear();
    terminateWatchChildren();
    expect(child.kill.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGKILL']);
  });

  it('warns exactly once when the child dies after the initial cycle', async () => {
    const { child, controller } = create();
    completeInitial(child);
    await controller.ready;

    child.emit('disconnect');
    child.emit('exit', 1, null);

    expect(
      vi
        .mocked(logger.warn)
        .mock.calls.filter(([message]) => String(message).includes('no longer refresh'))
    ).toHaveLength(1);
  });

  it('treats a structured fatal watcher event as watcher loss and tears the child down', async () => {
    const { child, controller } = create({ closeTimeoutMs: 1 });
    completeInitial(child);
    await controller.ready;

    child.emit('message', {
      protocol: COMPODOC_WATCH_PROTOCOL,
      version: COMPODOC_WATCH_PROTOCOL_VERSION,
      type: 'watch-fatal',
      error: { name: 'WatchError', message: 'observation stopped' },
    } satisfies CompodocWatchEvent);

    await vi.waitFor(() => expect(child.kill).toHaveBeenCalledWith('SIGTERM'));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('no longer refresh'));
  });

  it('stays quiet when the exit was initiated by shutdown', async () => {
    const { child, controller } = create({ closeTimeoutMs: 1 });
    completeInitial(child);
    await controller.ready;

    await controller.close();

    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('no longer refresh'));
  });
});

describe('compodocWatchPlugin', () => {
  const buildStart = (plugin: ReturnType<typeof compodocWatchPlugin>) =>
    (plugin.buildStart as unknown as () => Promise<void>).call({});
  const closeBundle = (plugin: ReturnType<typeof compodocWatchPlugin>) =>
    (plugin.closeBundle as unknown as () => Promise<void>).call({});

  it('does not start a watcher or fallback child after shutdown begins', async () => {
    const resolveCli = vi.fn(baseOptions().resolveCli);
    const plugin = compodocWatchPlugin({ ...baseOptions(), resolveCli });

    await closeBundle(plugin);
    await buildStart(plugin);

    expect(resolveCli).not.toHaveBeenCalled();
    expect(runCompodoc).not.toHaveBeenCalled();
  });

  it('does not start fallback when process teardown interrupts watcher startup', async () => {
    const child = new FakeChild();
    const plugin = compodocWatchPlugin({
      ...baseOptions(),
      spawn: () => child as any,
      handshakeTimeoutMs: 1_000,
    });

    const starting = buildStart(plugin);
    terminateWatchChildren();
    await starting;

    expect(runCompodoc).not.toHaveBeenCalled();
  });

  it('suppresses cold-start fallback when shutdown rejects readiness', async () => {
    const child = new FakeChild();
    const plugin = compodocWatchPlugin({
      ...baseOptions(),
      spawn: () => child as any,
      closeTimeoutMs: 1,
    });

    const starting = buildStart(plugin);
    emitCapability(child);
    await closeBundle(plugin);
    await starting;

    expect(runCompodoc).not.toHaveBeenCalled();
  });

  it('boots the dev server and generates once when the Compodoc CLI cannot be resolved', async () => {
    const plugin = compodocWatchPlugin({
      ...baseOptions(),
      resolveCli: () => {
        throw new Error('Cannot find module @compodoc/compodoc');
      },
    });

    await expect(buildStart(plugin)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Compodoc watch could not be started')
    );
    expect(runCompodoc).toHaveBeenCalledTimes(1);
  });

  it('generates once when the initial watch cycle never completes', async () => {
    const child = new FakeChild();
    const plugin = compodocWatchPlugin({
      ...baseOptions(),
      compodocArgs: ['--watch', '-w', '--serve', '-s', '--exportFormat', 'html', '-d', '.'],
      spawn: () => child as any,
      initialTimeoutMs: 1,
      closeTimeoutMs: 1,
    });

    const start = buildStart(plugin);
    emitCapability(child);
    await expect(start).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Compodoc initial watch cycle failed')
    );
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(runCompodoc).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceRoot: '/workspace',
        compodocArgs: ['-d', '.', '-e', 'json'],
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('aborts and awaits a fallback that has already started when shutdown begins', async () => {
    let observedSignal: AbortSignal | undefined;
    vi.mocked(runCompodoc).mockImplementationOnce(
      async ({ signal }) =>
        new Promise<void>((resolvePromise) => {
          observedSignal = signal;
          signal?.addEventListener('abort', () => resolvePromise(), { once: true });
        })
    );
    const plugin = compodocWatchPlugin({
      ...baseOptions(),
      resolveCli: () => {
        throw new Error('Cannot find module @compodoc/compodoc');
      },
    });

    const starting = buildStart(plugin);
    await vi.waitFor(() => expect(runCompodoc).toHaveBeenCalledOnce());
    const closing = closeBundle(plugin);
    await closing;
    await starting;

    expect(observedSignal?.aborted).toBe(true);
  });

  it('replaces an existing documentation.json with a freshly owned fallback snapshot', async () => {
    vol.fromNestedJSON({ '/workspace/documentation.json': '{"stale":true}' });
    const plugin = compodocWatchPlugin({
      ...baseOptions(),
      resolveCli: () => {
        throw new Error('Cannot find module @compodoc/compodoc');
      },
    });

    await buildStart(plugin);

    expect(runCompodoc).toHaveBeenCalledOnce();
    expect(vol.readFileSync('/workspace/documentation.json', 'utf8')).toBe('{"fresh":true}');
  });

  it('keeps stale bytes outside the canonical reader path when fallback produces no output', async () => {
    vol.fromNestedJSON({ '/workspace/documentation.json': '{"lastGood":true}' });
    vi.mocked(runCompodoc).mockRejectedValueOnce(new Error('released Compodoc failed'));
    const plugin = compodocWatchPlugin({
      ...baseOptions(),
      resolveCli: () => {
        throw new Error('Cannot find module @compodoc/compodoc');
      },
    });

    await buildStart(plugin);

    expect(vol.existsSync('/workspace/documentation.json')).toBe(false);
    const recoveryEntry = Object.entries(vol.toJSON()).find(([file]) =>
      file.startsWith('/workspace/documentation.json.storybook-backup-')
    );
    expect(recoveryEntry?.[1]).toBe('{"lastGood":true}');
  });

  it('awaits an aborted released config-owned fallback before restoring ownership', async () => {
    vol.fromNestedJSON({ '/workspace/documentation.json': '{"lastGood":true}' });
    let observedSignal: AbortSignal | undefined;
    vi.mocked(runCompodoc).mockImplementationOnce(async ({ signal }) => {
      observedSignal = signal;
      return new Promise<void>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });
    const plugin = compodocWatchPlugin({
      ...baseOptions(),
      compodocArgs: ['--config', 'user-with-watch.json'],
      initialTimeoutMs: 1,
      closeTimeoutMs: 1,
      resolveCli: () => {
        throw new Error('protocol unavailable');
      },
    });

    await expect(buildStart(plugin)).resolves.toBeUndefined();

    expect(observedSignal?.aborted).toBe(true);
    expect(vol.existsSync('/workspace/documentation.json')).toBe(false);
    expect(
      Object.entries(vol.toJSON()).find(([file]) =>
        file.startsWith('/workspace/documentation.json.storybook-backup-')
      )?.[1]
    ).toBe('{"lastGood":true}');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('fallback produced no readable documentation.json')
    );
  });

  it('preserves user config while stripping watch, serve, and coverage CLI ownership', async () => {
    const plugin = compodocWatchPlugin({
      ...baseOptions(),
      compodocArgs: [
        '-tw',
        '-tdcustom',
        '--config',
        'user.json',
        '--coverageTest',
        '80',
        '--files',
        'src/button.ts',
        '--serve',
      ],
      resolveCli: () => {
        throw new Error('Cannot find module @compodoc/compodoc');
      },
    });

    await buildStart(plugin);

    const fallbackArgs = vi.mocked(runCompodoc).mock.calls[0][0].compodocArgs;
    expect(fallbackArgs).toEqual([
      '-t',
      '-t',
      '-d',
      'custom',
      '--config',
      'user.json',
      '-e',
      'json',
    ]);
  });

  it('terminates a released config-owned watch after its fresh JSON becomes readable', async () => {
    let observedSignal: AbortSignal | undefined;
    vi.mocked(runCompodoc).mockImplementationOnce(async ({ signal, compodocArgs }) => {
      observedSignal = signal;
      expect(compodocArgs).toContain('user.json');
      vol.fromNestedJSON({ '/workspace/documentation.json': '{"freshConfig":true}' });
      return new Promise<void>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });
    const plugin = compodocWatchPlugin({
      ...baseOptions(),
      compodocArgs: ['--config', 'user.json'],
      closeTimeoutMs: 1,
      resolveCli: () => {
        throw new Error('protocol unavailable');
      },
    });

    await buildStart(plugin);

    expect(observedSignal?.aborted).toBe(true);
    expect(vol.readFileSync('/workspace/documentation.json', 'utf8')).toBe('{"freshConfig":true}');
  });

  it('waits for the initial cycle before the dev server starts', async () => {
    const child = new FakeChild();
    const refresh = vi.fn(async () => undefined);
    const plugin = compodocWatchPlugin({
      ...baseOptions(),
      spawn: () => child as any,
      refresh,
      initialTimeoutMs: 50,
      closeTimeoutMs: 1,
    });

    let started = false;
    const start = buildStart(plugin).then(() => {
      started = true;
    });

    await Promise.resolve();
    expect(started).toBe(false);

    completeInitial(child);
    await start;
    expect(started).toBe(true);

    child.emit('message', completion(2));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(runCompodoc).not.toHaveBeenCalled();
  });
});
