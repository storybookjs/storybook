import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import { experimental_UniversalStore } from 'storybook/internal/core-server';
import type { Options } from 'storybook/internal/types';

import { TRIGGER_TEST_RUN_REQUEST, TRIGGER_TEST_RUN_RESPONSE } from '../constants.ts';
import { runTestRunner } from './boot-test-runner.ts';

const testProviderStore = vi.hoisted(() => ({
  setState: vi.fn(),
  onClearAll: vi.fn(),
}));

vi.mock('storybook/internal/core-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/core-server')>();
  return {
    ...actual,
    experimental_UniversalStore: {
      create: vi.fn(
        (storeOptions: never) => new actual.experimental_MockUniversalStore(storeOptions)
      ),
    },
    experimental_getTestProviderStore: vi.fn(() => testProviderStore),
  };
});

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    createFileSystemCache: vi.fn(() => ({
      get: vi.fn(async (_key: string, fallback: unknown) => fallback),
      set: vi.fn(),
    })),
    loadPreviewOrConfigFile: vi.fn(() => undefined),
  };
});

vi.mock('./boot-test-runner.ts', () => ({
  runTestRunner: vi.fn(),
}));

vi.mock('../logger.ts', () => ({
  log: vi.fn(),
}));

function makeOptions({ builder = '@storybook/builder-vite' }: { builder?: string } = {}): Options {
  return {
    configDir: '.storybook',
    presets: {
      apply: vi.fn(async (key: string, fallback?: unknown) => {
        switch (key) {
          case 'core':
            return { builder };
          case 'previewAnnotations':
            return [];
          case 'storyIndexGenerator':
            return { getIndex: async () => ({ v: 5, entries: {} }) };
          default:
            return fallback;
        }
      }),
    },
  } as unknown as Options;
}

/** The responder memoizes its store at module level, so each test needs a fresh module. */
async function loadResponder() {
  vi.resetModules();
  return import('./test-run-responder.ts');
}

function emitRequest(channel: Channel, requestId: string) {
  channel.emit(TRIGGER_TEST_RUN_REQUEST, { requestId, actor: 'test-actor' });
}

beforeEach(() => {
  vi.clearAllMocks();
  // The real runTestRunner is async; the responder chains .catch on its return value.
  vi.mocked(runTestRunner).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('wireTestRunResponder', () => {
  it('answers a request by triggering a run and relaying the completed result', async () => {
    const { wireTestRunResponder } = await loadResponder();
    const channel = new Channel({});
    const responses = vi.fn();
    channel.on(TRIGGER_TEST_RUN_RESPONSE, responses);

    await wireTestRunResponder({ channel, options: makeOptions() });
    emitRequest(channel, 'req-1');

    // The lazy setup finishes before TRIGGER_RUN boots the child.
    await vi.waitFor(() => expect(runTestRunner).toHaveBeenCalledOnce());

    const [{ store }] = vi.mocked(runTestRunner).mock.calls[0];
    store.send({
      type: 'TEST_RUN_COMPLETED',
      payload: { componentTestCount: { success: 1, error: 0 } } as never,
    });

    await vi.waitFor(() =>
      expect(responses).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-1',
          status: 'completed',
          result: expect.objectContaining({ componentTestCount: { success: 1, error: 0 } }),
        })
      )
    );
  });

  it('creates the runner machinery lazily, once, shared with the eager dev-server path', async () => {
    const { wireTestRunResponder, ensureTestRunnerStore } = await loadResponder();
    const channel = new Channel({});
    const options = makeOptions();

    await wireTestRunResponder({ channel, options });
    expect(experimental_UniversalStore.create).not.toHaveBeenCalled();

    emitRequest(channel, 'req-1');
    await vi.waitFor(() => expect(experimental_UniversalStore.create).toHaveBeenCalledOnce());

    // The dev server's eager path reuses the memoized store...
    const store = await ensureTestRunnerStore({ channel, options });
    store.send({ type: 'TEST_RUN_COMPLETED', payload: {} as never });
    await vi.waitFor(() =>
      expect(channel.last(TRIGGER_TEST_RUN_RESPONSE)).toEqual([
        expect.objectContaining({ requestId: 'req-1' }),
      ])
    );

    // ...and so does a second request once the first has completed.
    emitRequest(channel, 'req-2');
    await vi.waitFor(() => expect(runTestRunner).toHaveBeenCalledTimes(2));
    store.send({ type: 'TEST_RUN_COMPLETED', payload: {} as never });
    await vi.waitFor(() =>
      expect(channel.last(TRIGGER_TEST_RUN_RESPONSE)).toEqual([
        expect.objectContaining({ requestId: 'req-2' }),
      ])
    );
    expect(experimental_UniversalStore.create).toHaveBeenCalledOnce();
  });

  it('rejects a concurrent request while a requested run is still in flight', async () => {
    const { wireTestRunResponder } = await loadResponder();
    const channel = new Channel({});
    const responses = vi.fn();
    channel.on(TRIGGER_TEST_RUN_RESPONSE, responses);

    await wireTestRunResponder({ channel, options: makeOptions() });
    emitRequest(channel, 'req-1');
    await vi.waitFor(() => expect(runTestRunner).toHaveBeenCalledOnce());

    // `currentRun.startedAt` is only written by the vitest child once it starts, so the
    // already-running guard cannot rely on store state alone.
    emitRequest(channel, 'req-2');
    await vi.waitFor(() =>
      expect(responses).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-2',
          status: 'error',
          error: expect.objectContaining({ message: 'Tests are already running' }),
        })
      )
    );
    expect(runTestRunner).toHaveBeenCalledOnce();

    const [{ store }] = vi.mocked(runTestRunner).mock.calls[0];
    store.send({ type: 'TEST_RUN_COMPLETED', payload: {} as never });
    await vi.waitFor(() =>
      expect(responses).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'req-1', status: 'completed' })
      )
    );
  });

  it('wires nothing without a channel', async () => {
    const { wireTestRunResponder } = await loadResponder();
    const options = makeOptions();

    await wireTestRunResponder({ channel: undefined, options });

    expect(options.presets.apply).not.toHaveBeenCalled();
  });

  it('wires nothing on an attached tools host, so the instance remains the only leader', async () => {
    vi.stubEnv('STORYBOOK_ATTACHED_TOOLS', 'true');
    const { wireTestRunResponder } = await loadResponder();
    const channel = new Channel({});
    const responses = vi.fn();
    channel.on(TRIGGER_TEST_RUN_RESPONSE, responses);

    await wireTestRunResponder({ channel, options: makeOptions() });
    emitRequest(channel, 'req-1');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(responses).not.toHaveBeenCalled();
    expect(experimental_UniversalStore.create).not.toHaveBeenCalled();
  });

  it('wires nothing inside the vitest child process', async () => {
    vi.stubEnv('VITEST_CHILD_PROCESS', 'true');
    const { wireTestRunResponder } = await loadResponder();
    const channel = new Channel({});
    const responses = vi.fn();
    channel.on(TRIGGER_TEST_RUN_RESPONSE, responses);

    await wireTestRunResponder({ channel, options: makeOptions() });
    emitRequest(channel, 'req-1');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(responses).not.toHaveBeenCalled();
    expect(experimental_UniversalStore.create).not.toHaveBeenCalled();
  });

  it('answers non-Vite builders with an immediate error instead of leaving requests unanswered', async () => {
    const { wireTestRunResponder } = await loadResponder();
    const channel = new Channel({});
    const responses = vi.fn();
    channel.on(TRIGGER_TEST_RUN_RESPONSE, responses);

    await wireTestRunResponder({
      channel,
      options: makeOptions({ builder: '@storybook/builder-webpack5' }),
    });
    emitRequest(channel, 'req-1');

    await vi.waitFor(() =>
      expect(responses).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-1',
          status: 'error',
          error: expect.objectContaining({ message: expect.stringContaining('Vite') }),
        })
      )
    );
    // The vitest runner machinery must never boot for a Webpack project.
    expect(experimental_UniversalStore.create).not.toHaveBeenCalled();
  });

  it('answers a failed setup with an error, and retries it instead of memoizing the failure', async () => {
    const { wireTestRunResponder } = await loadResponder();
    const channel = new Channel({});
    const responses = vi.fn();
    channel.on(TRIGGER_TEST_RUN_RESPONSE, responses);
    const options = makeOptions();
    const defaultApply = vi.mocked(options.presets.apply).getMockImplementation()!;
    let failSetup = true;
    vi.mocked(options.presets.apply).mockImplementation(async (key: string, fallback?: unknown) => {
      if (key === 'storyIndexGenerator' && failSetup) {
        failSetup = false;
        throw new Error('index generation failed');
      }
      return defaultApply(key, fallback);
    });

    await wireTestRunResponder({ channel, options });
    emitRequest(channel, 'req-1');

    // Without a response the requester would wait out its full timeout.
    await vi.waitFor(() =>
      expect(responses).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-1',
          status: 'error',
          error: expect.objectContaining({
            message: 'Failed to set up the test runner',
            error: expect.objectContaining({ message: 'index generation failed' }),
          }),
        })
      )
    );

    // The rejected setup is not memoized: the next request retries and succeeds.
    emitRequest(channel, 'req-2');
    await vi.waitFor(() => expect(runTestRunner).toHaveBeenCalledOnce());
    const [{ store }] = vi.mocked(runTestRunner).mock.calls[0];
    store.send({ type: 'TEST_RUN_COMPLETED', payload: {} as never });
    await vi.waitFor(() =>
      expect(responses).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'req-2', status: 'completed' })
      )
    );
  });
});
