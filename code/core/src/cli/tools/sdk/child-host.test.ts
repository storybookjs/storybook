import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnyToolsetOutcome } from '../../../shared/open-service/toolset-definition.ts';
import { runChildHost } from './child-host.ts';
import { CHILD_HOST_PROTOCOL_VERSION } from './child-protocol.ts';
import { createTools } from './create-tools.ts';
import type { Tools, ToolsetCatalog } from './types.ts';

vi.mock('./create-tools.ts', { spy: true });

describe('runChildHost', () => {
  const send = vi.fn();
  const handlers: Array<(message: unknown) => void> = [];
  const close = vi.fn(async () => {});
  const describe = vi.fn(async () => ({ configDir: '/repo/.storybook', toolsets: [] }));
  const call = vi.fn(
    async (
      _ref: string,
      _input?: Record<string, unknown>,
      options?: {
        signal?: AbortSignal;
        telemetry?: (event: string, payload: Record<string, unknown>) => Promise<void>;
      }
    ): Promise<AnyToolsetOutcome> => {
      if (options?.signal?.aborted) {
        throw new Error('aborted');
      }
      return { ok: true, data: { ran: true }, markdown: 'ok' };
    }
  );

  beforeEach(() => {
    send.mockReset();
    close.mockReset();
    describe.mockReset();
    call.mockReset();
    handlers.length = 0;
    vi.stubEnv('STORYBOOK_ATTACHED_TOOLS', undefined);
    vi.stubEnv('STORYBOOK_TOOLS_CHILD_HOST', undefined);
    vi.mocked(createTools).mockReset();
    vi.mocked(createTools).mockResolvedValue({
      mode: 'attached',
      requestedMode: 'attached',
      host: 'in-process',
      clientInfo: { name: 'storybook-tools-sdk', version: '10.2.0', kind: 'sdk' },
      storybook: { version: '10.2.0', configDir: '/repo/.storybook', url: 'http://localhost:6006' },
      runtime: {
        configDir: '/repo/.storybook',
        toolsets: [],
        getService: () => {
          throw new Error('unused');
        },
      },
      describe,
      call,
      close,
    } as unknown as Tools);
    describe.mockResolvedValue({
      configDir: '/repo/.storybook',
      toolsets: [],
    } satisfies ToolsetCatalog);
    call.mockImplementation(async (_ref, _input, options) => {
      if (options?.signal?.aborted) {
        throw new Error('aborted');
      }
      return { ok: true, data: { ran: true }, markdown: 'ok' };
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('boots local tools when init asks for local mode', async () => {
    vi.mocked(createTools).mockResolvedValue({
      mode: 'local',
      host: 'in-process',
      clientInfo: { name: 'storybook-tools-sdk', version: '10.2.0', kind: 'sdk' },
      storybook: { version: '10.2.0', configDir: '/repo/.storybook' },
      runtime: {
        configDir: '/repo/.storybook',
        toolsets: [],
        getService: () => {
          throw new Error('unused');
        },
      },
      describe,
      call,
      close,
    } as unknown as Tools);

    await runChildHost({
      send,
      subscribe: (handler) => {
        handlers.push(handler);
      },
      cwd: () => '/repo',
    });

    handlers[0]({
      type: 'init',
      options: {
        mode: 'local',
        clientInfo: { name: 'storybook-cli', version: '1.0.0', kind: 'cli' },
      },
    });
    await vi.waitFor(() => expect(createTools).toHaveBeenCalled());
    expect(createTools).toHaveBeenCalledWith({
      clientInfo: { name: 'storybook-cli', version: '1.0.0', kind: 'cli' },
      cwd: '/repo',
      mode: 'local',
      autoSpawn: false,
    });
    expect(process.env.STORYBOOK_ATTACHED_TOOLS).toBeUndefined();
  });

  it('boots attached tools with autoSpawn declined and answers describe/call/close', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    await runChildHost({
      send,
      subscribe: (handler) => {
        handlers.push(handler);
      },
      cwd: () => '/repo',
    });

    handlers[0]({
      type: 'init',
      options: { clientInfo: { name: 'storybook-cli', version: '1.0.0', kind: 'cli' } },
    });
    await vi.waitFor(() => expect(createTools).toHaveBeenCalled());
    expect(createTools).toHaveBeenCalledWith({
      clientInfo: { name: 'storybook-cli', version: '1.0.0', kind: 'cli' },
      cwd: '/repo',
      mode: 'attached',
      autoSpawn: false,
    });
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'hello', version: CHILD_HOST_PROTOCOL_VERSION })
      )
    );

    handlers[0]({ type: 'describe', id: '1', options: {} });
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'result',
          id: '1',
          value: { configDir: '/repo/.storybook', toolsets: [] },
        })
      )
    );

    handlers[0]({ type: 'call', id: '2', ref: 'docs.list', input: { id: 'x' } });
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'result',
          id: '2',
          value: { ok: true, data: { ran: true }, markdown: 'ok' },
        })
      )
    );

    handlers[0]({ type: 'close' });
    await vi.waitFor(() => expect(close).toHaveBeenCalled());
    expect(exit).toHaveBeenCalledWith(0);
    exit.mockRestore();
  });

  it('forwards method telemetry over IPC keyed by the call id', async () => {
    call.mockImplementation(async (_ref, _input, options) => {
      await options?.telemetry?.('tool:listAllDocumentation', { toolset: 'docs' });
      return { ok: true, data: { ran: true }, markdown: 'ok' };
    });
    await runChildHost({
      send,
      subscribe: (handler) => {
        handlers.push(handler);
      },
      cwd: () => '/repo',
    });
    handlers[0]({ type: 'init', options: {} });
    await vi.waitFor(() => expect(createTools).toHaveBeenCalled());

    handlers[0]({ type: 'call', id: 'call-7', ref: 'docs.list', input: {} });
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith({
        type: 'telemetry',
        id: 'call-7',
        event: 'tool:listAllDocumentation',
        payload: { toolset: 'docs' },
      })
    );
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'result', id: 'call-7' }))
    );
  });

  it('cancels an in-flight call when a cancel envelope arrives', async () => {
    let release: (() => void) | undefined;
    call.mockImplementation(
      (_ref, _input, options) =>
        new Promise((resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
          release = () => resolve({ ok: true, data: {}, markdown: '' });
        })
    );
    await runChildHost({
      send,
      subscribe: (handler) => {
        handlers.push(handler);
      },
      cwd: () => '/repo',
    });
    handlers[0]({ type: 'init', options: {} });
    await vi.waitFor(() => expect(createTools).toHaveBeenCalled());

    handlers[0]({ type: 'call', id: 'call-1', ref: 'docs.list', input: {} });
    await vi.waitFor(() => expect(call).toHaveBeenCalled());
    handlers[0]({ type: 'cancel', id: 'call-1' });
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', id: 'call-1' }))
    );
    release?.();
  });
});
