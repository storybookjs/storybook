import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { telemetry } from 'storybook/internal/telemetry';

import * as v from 'valibot';

import {
  defineToolset,
  type AnyToolsetOutcome,
} from '../../../shared/open-service/toolset-definition.ts';
import { createTools } from './create-tools.ts';
import { AttachUnavailableError, SpawnFailedError } from './errors.ts';
import { bootstrapToolsRuntime, type ToolsRuntime } from './local-runtime.ts';

vi.mock('./local-runtime.ts', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });

const CONFIG_DIR = '/repo/.storybook';

const echo = defineToolset({
  id: 'echo',
  description: 'Toolset used to exercise the SDK surface.',
  methods: {
    ok: {
      title: 'Echo the input',
      description: 'Echo the input back.',
      input: v.object({ value: v.string() }),
      output: v.object({ value: v.string() }),
      handler: async (input) => ({ ok: true as const, data: input, markdown: input.value }),
    },
    bad: {
      title: 'Report bad news',
      description: 'Report bad news without throwing.',
      input: v.object({}),
      handler: async () => ({ ok: false as const, data: { reason: 'nope' }, markdown: 'nope' }),
    },
    live: {
      title: 'Need a dev server',
      description: 'Needs a running Storybook.',
      input: v.object({}),
      requiresDevServer: true,
      handler: async () => ({ ok: true as const, data: {}, markdown: '' }),
    },
  },
});

function makeRuntime(overrides: Partial<ToolsRuntime> = {}): ToolsRuntime {
  return {
    configDir: CONFIG_DIR,
    toolsets: [echo],
    getService: () => {
      throw new Error('no services registered in this test');
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(bootstrapToolsRuntime).mockReset();
  vi.mocked(bootstrapToolsRuntime).mockResolvedValue(makeRuntime());
  vi.mocked(telemetry).mockReset();
  vi.mocked(telemetry).mockResolvedValue(undefined);
  attach.mockReset();
  spawnChild.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const attach = vi.fn();
const spawnChild = vi.fn();

describe('createTools', () => {
  it('loads the target configuration in this process in local mode', async () => {
    const tools = await createTools({ cwd: '/repo', configDir: '.storybook', mode: 'local' });

    expect(bootstrapToolsRuntime).toHaveBeenCalledWith({ cwd: '/repo', configDir: '.storybook' });
    expect(tools.mode).toBe('local');
    expect(tools.requestedMode).toBe('local');
    expect(tools.host).toBe('in-process');
    expect(tools.storybook.configDir).toBe(CONFIG_DIR);
    expect(tools.storybook.version).toEqual(expect.any(String));
  });

  it('stamps the client as the SDK unless the caller says otherwise', async () => {
    const defaulted = await createTools({ mode: 'local' });
    const named = await createTools({
      mode: 'local',
      clientInfo: { name: 'storybook-cli', version: '1.2.3', kind: 'cli' },
    });

    expect(defaulted.clientInfo.kind).toBe('sdk');
    expect(named.clientInfo).toEqual({ name: 'storybook-cli', version: '1.2.3', kind: 'cli' });
  });

  it('joins a running Storybook in attached mode without loading the local runtime', async () => {
    const attach = vi.fn(async () => ({
      runtime: makeRuntime(),
      record: { url: 'http://localhost:6006', pid: 123, configDir: CONFIG_DIR },
      connection: { close: vi.fn(), disconnected: new Promise<never>(() => {}) },
    }));

    const tools = await createTools({ cwd: '/repo', mode: 'attached' }, { attach });

    expect(attach).toHaveBeenCalledWith({ cwd: '/repo', configDir: undefined });
    expect(bootstrapToolsRuntime).not.toHaveBeenCalled();
    expect(tools.mode).toBe('attached');
    expect(tools.storybook).toMatchObject({
      configDir: CONFIG_DIR,
      url: 'http://localhost:6006',
      pid: 123,
    });
  });

  it('sets STORYBOOK_ATTACHED_TOOLS before attaching so store construction stays a follower', async () => {
    delete process.env.STORYBOOK_ATTACHED_TOOLS;
    const attach = vi.fn(async () => {
      expect(process.env.STORYBOOK_ATTACHED_TOOLS).toBe('true');
      return {
        runtime: makeRuntime(),
        record: { url: 'http://localhost:6006', pid: 123, configDir: CONFIG_DIR },
        connection: { close: vi.fn(), disconnected: new Promise<never>(() => {}) },
      };
    });

    await createTools({ mode: 'attached' }, { attach });

    expect(attach).toHaveBeenCalledOnce();
  });

  it('runs a requiresDevServer method when attached', async () => {
    const attach = vi.fn(async () => ({
      runtime: makeRuntime(),
      record: { url: 'http://localhost:6006', pid: 123, configDir: CONFIG_DIR },
      connection: { close: vi.fn(), disconnected: new Promise<never>(() => {}) },
    }));
    const tools = await createTools({ mode: 'attached' }, { attach });

    await expect(tools.call('echo.live')).resolves.toEqual({
      ok: true,
      data: {},
      markdown: '',
    });
  });

  it('spawns a child host when attach reports a fidelity mismatch that auto-spawn can fix', async () => {
    const record = {
      schemaVersion: 1 as const,
      instanceId: 'abc',
      pid: 123,
      cwd: '/repo',
      configDir: CONFIG_DIR,
      url: 'http://localhost:6006',
      port: 6006,
      token: 'secret',
      storybookVersion: '10.2.0',
      mcp: { status: 'ready' as const },
    };
    const spawned = {
      mode: 'attached' as const,
      requestedMode: 'attached' as const,
      host: 'child' as const,
      clientInfo: { name: 'storybook-tools-sdk', version: '0.0.0', kind: 'sdk' as const },
      storybook: { version: '10.2.0', configDir: CONFIG_DIR, url: record.url, pid: record.pid },
      runtime: makeRuntime(),
      describe: async () => ({ configDir: CONFIG_DIR, toolsets: [] }),
      call: async () => ({ ok: true as const, data: {}, markdown: 'spawned' }),
      close: async () => {},
    };
    vi.mocked(attach).mockResolvedValue({ kind: 'spawn' as const, record });
    vi.mocked(spawnChild).mockResolvedValue(spawned);

    const tools = await createTools(
      { cwd: '/elsewhere', mode: 'attached' },
      { attach, spawnChild }
    );

    expect(spawnChild).toHaveBeenCalledWith({
      record,
      options: expect.objectContaining({
        cwd: '/repo',
        mode: 'attached',
        autoSpawn: false,
      }),
      clientInfo: expect.objectContaining({ kind: 'sdk' }),
      requestedMode: 'attached',
    });
    expect(bootstrapToolsRuntime).not.toHaveBeenCalled();
    await expect(tools.call('echo.ok')).resolves.toEqual({
      ok: true,
      data: {},
      markdown: 'spawned',
    });
  });

  it('prefers attached mode by default and falls back to local on a gate failure', async () => {
    const attach = vi.fn(async () => ({
      runtime: makeRuntime(),
      record: { url: 'http://localhost:6006', pid: 123, configDir: CONFIG_DIR },
      connection: { close: vi.fn(), disconnected: new Promise<never>(() => {}) },
    }));

    const attached = await createTools({ cwd: '/repo' }, { attach });

    expect(attach).toHaveBeenCalledWith({ cwd: '/repo', configDir: undefined });
    expect(bootstrapToolsRuntime).not.toHaveBeenCalled();
    expect(attached.mode).toBe('attached');
    expect(attached.fallbackNotice).toBeUndefined();

    attach.mockRejectedValueOnce(
      new AttachUnavailableError({
        reason: 'no-instance',
        instances: [],
        remediation:
          'No running Storybook was found for this project. Start it first (for example `npm run storybook`), then retry with `--attach`.',
      })
    );

    const fallback = await createTools({ cwd: '/repo' }, { attach });

    expect(bootstrapToolsRuntime).toHaveBeenCalledWith({ cwd: '/repo', configDir: undefined });
    expect(fallback.mode).toBe('local');
    expect(fallback.requestedMode).toBe('auto');
    expect(fallback.host).toBe('in-process');
    expect(fallback.fallbackReason).toBe('no-instance');
    expect(fallback.fallbackNotice).toContain('No running Storybook was found');
    expect(fallback.fallbackNotice).toContain('Falling back');
  });

  it('does not fall back from attached mode, or from a config-load failure', async () => {
    const attach = vi.fn(async () => {
      throw new AttachUnavailableError({
        reason: 'connection-failed',
        instances: [],
        remediation: 'Could not connect to the Storybook at http://localhost:6006.',
      });
    });

    await expect(createTools({ mode: 'attached' }, { attach })).rejects.toThrow(
      AttachUnavailableError
    );
    expect(bootstrapToolsRuntime).not.toHaveBeenCalled();

    attach.mockRejectedValueOnce(
      new SpawnFailedError({
        reason: 'Could not resolve the `storybook` package from /repo.',
      })
    );
    const spawnedFallback = await createTools({ mode: 'auto' }, { attach });
    expect(spawnedFallback.mode).toBe('local');
    expect(spawnedFallback.fallbackNotice).toContain('Could not resolve');

    vi.mocked(bootstrapToolsRuntime).mockRejectedValueOnce(
      new Error('No configuration files found')
    );
    const localLoadFailure = createTools(
      { mode: 'auto' },
      {
        attach: async () => {
          throw new AttachUnavailableError({
            reason: 'no-instance',
            instances: [],
            remediation: 'No running Storybook.',
          });
        },
      }
    );
    await expect(localLoadFailure).rejects.toMatchObject({
      data: { reason: 'config-load-failed' },
    });
    await expect(localLoadFailure).rejects.toThrow('Falling back');
  });

  it('applies per-call origin and telemetry to the method context', async () => {
    const sink = vi.fn(async () => {});
    vi.mocked(bootstrapToolsRuntime).mockResolvedValue(
      makeRuntime({
        toolsets: [
          defineToolset({
            id: 'probe',
            description: 'Records call context.',
            methods: {
              ping: {
                title: 'Ping',
                description: 'ping',
                input: v.object({}),
                handler: async (_input, ctx) => {
                  await ctx.telemetry?.('tool:ping', { toolset: 'probe' });
                  return {
                    ok: true as const,
                    data: { origin: ctx.origin },
                    markdown: ctx.origin ?? '',
                  };
                },
              },
            },
          }),
        ],
      })
    );
    const tools = await createTools({ mode: 'local' });

    const outcome = await tools.call(
      'probe.ping',
      {},
      { origin: 'http://localhost:9', telemetry: sink }
    );

    expect(outcome).toMatchObject({ data: { origin: 'http://localhost:9' } });
    expect(sink).toHaveBeenCalledWith(
      'tool:ping',
      expect.objectContaining({
        toolset: 'probe',
        client: 'sdk',
        requestedMode: 'local',
        resolvedMode: 'local',
        attachMode: 'local',
        host: 'in-process',
      })
    );
  });

  it('wraps a configuration that cannot be loaded', async () => {
    const cause = new Error('No configuration files found');
    vi.mocked(bootstrapToolsRuntime).mockRejectedValue(cause);

    const failure = createTools({ mode: 'local' });

    await expect(failure).rejects.toMatchObject({ data: { reason: 'config-load-failed' }, cause });
    await expect(failure).rejects.toThrow(
      'Could not load the Storybook configuration for this project: No configuration files found'
    );
  });
});

describe('describe', () => {
  it('renders every registered toolset with its schemas as JSON Schema', async () => {
    const tools = await createTools({ mode: 'local' });

    const catalog = await tools.describe();

    expect(catalog.configDir).toBe(CONFIG_DIR);
    expect(catalog.toolsets).toHaveLength(1);
    expect(catalog.toolsets[0]).toMatchObject({
      id: 'echo',
      description: 'Toolset used to exercise the SDK surface.',
    });
    expect(catalog.toolsets[0].methods[0]).toEqual({
      ref: 'echo.ok',
      title: 'Echo the input',
      description: 'Echo the input back.',
      requiresDevServer: false,
      input: expect.objectContaining({
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
      }),
      output: expect.objectContaining({ type: 'object' }),
    });
  });

  it('marks the methods that need a running Storybook', async () => {
    const tools = await createTools({ mode: 'local' });

    const catalog = await tools.describe();

    expect(
      catalog.toolsets[0].methods.map(({ ref, requiresDevServer }) => [ref, requiresDevServer])
    ).toEqual([
      ['echo.ok', false],
      ['echo.bad', false],
      ['echo.live', true],
    ]);
  });

  it('restricts the catalog to one toolset', async () => {
    const tools = await createTools({ mode: 'local' });

    const catalog = await tools.describe({ toolset: 'echo' });

    expect(catalog.toolsets.map((toolset) => toolset.id)).toEqual(['echo']);
  });

  it('rejects an unknown toolset with the ids the project provides', async () => {
    const tools = await createTools({ mode: 'local' });

    await expect(tools.describe({ toolset: 'nope' })).rejects.toMatchObject({
      data: { reason: 'unknown-toolset' },
    });
    await expect(tools.describe({ toolset: 'nope' })).rejects.toThrow('provides: echo');
  });

  it('reports a schema with no JSON Schema representation as absent', async () => {
    const foreign = defineToolset({
      id: 'foreign',
      description: 'Toolset with a non-valibot standard schema.',
      methods: {
        probe: {
          title: 'Probe',
          description: 'probe',
          input: {
            '~standard': {
              version: 1,
              vendor: 'not-valibot',
              validate: (value: unknown) => ({ value }),
            },
          } as never,
          handler: async () => ({ ok: true as const, data: {}, markdown: '' }),
        },
      },
    });
    vi.mocked(bootstrapToolsRuntime).mockResolvedValue(makeRuntime({ toolsets: [foreign] }));
    const tools = await createTools({ mode: 'local' });

    const catalog = await tools.describe();

    expect(catalog.toolsets[0].methods[0].input).toBeUndefined();
  });
});

describe('call', () => {
  it('runs the method and returns its outcome', async () => {
    const tools = await createTools({ mode: 'local' });

    const outcome = await tools.call('echo.ok', { value: 'hello' });

    expect(outcome).toEqual({ ok: true, data: { value: 'hello' }, markdown: 'hello' });
  });

  it('returns a failing outcome rather than throwing when the tool reports bad news', async () => {
    const tools = await createTools({ mode: 'local' });

    const outcome = await tools.call('echo.bad');

    expect(outcome).toEqual({ ok: false, data: { reason: 'nope' }, markdown: 'nope' });
  });

  it('rejects input the method’s own schema refuses', async () => {
    const tools = await createTools({ mode: 'local' });

    await expect(tools.call('echo.ok', { value: 7 })).rejects.toMatchObject({
      data: { reason: 'invalid-input' },
    });
    await expect(tools.call('echo.ok', { value: 7 })).rejects.toThrow(
      'Invalid input for `echo.ok`'
    );
  });

  it('rejects an unknown toolset, an unknown method, and a malformed reference', async () => {
    const tools = await createTools({ mode: 'local' });

    await expect(tools.call('nope.ok')).rejects.toMatchObject({
      data: { reason: 'unknown-toolset' },
    });
    await expect(tools.call('echo.nope')).rejects.toMatchObject({
      data: { reason: 'unknown-method' },
    });
    await expect(tools.call('echo')).rejects.toThrow('Expected `toolsetId.methodName`');
  });

  it('rejects a method that needs a running Storybook with attach guidance', async () => {
    const tools = await createTools({ mode: 'local' });

    const failure = tools.call('echo.live');

    await expect(failure).rejects.toThrow(AttachUnavailableError);
    await expect(failure).rejects.toMatchObject({
      data: { reason: 'no-instance', instances: [] },
      agentFacing: true,
    });
    await expect(failure).rejects.toThrow('needs a running Storybook dev server');
  });

  it('rejects an already-aborted signal before running anything', async () => {
    const tools = await createTools({ mode: 'local' });

    await expect(
      tools.call('echo.ok', { value: 'hello' }, { signal: AbortSignal.abort() })
    ).rejects.toThrow();
  });

  it('rejects an in-flight call when the signal aborts', async () => {
    const hang = defineToolset({
      id: 'hang',
      description: 'Never settles.',
      methods: {
        never: {
          title: 'Hang',
          description: 'hang',
          input: v.object({}),
          handler: () => new Promise<AnyToolsetOutcome>(() => {}),
        },
      },
    });
    vi.mocked(bootstrapToolsRuntime).mockResolvedValue(makeRuntime({ toolsets: [hang] }));
    const tools = await createTools({ mode: 'local' });
    const controller = new AbortController();

    const pending = tools.call('hang.never', {}, { signal: controller.signal });
    controller.abort('stopped');

    await expect(pending).rejects.toBe('stopped');
  });

  it('serves no calls once closed', async () => {
    const tools = await createTools({ mode: 'local' });

    await tools.close();

    await expect(tools.call('echo.ok', { value: 'hello' })).rejects.toMatchObject({
      data: { reason: 'closed' },
    });
    await expect(tools.describe()).rejects.toMatchObject({ data: { reason: 'closed' } });
  });
});

function invocationPayloads(): unknown[] {
  return vi
    .mocked(telemetry)
    .mock.calls.filter(
      ([eventType, payload]) =>
        eventType === 'tools-command' && payload !== undefined && !('event' in payload)
    )
    .map(([, payload]) => payload);
}

describe('tools-command telemetry', () => {
  it('emits an SDK invocation event for a successful local call', async () => {
    const tools = await createTools({ mode: 'local' });

    await tools.call('echo.ok', { value: 'hello' });

    expect(invocationPayloads()).toEqual([
      expect.objectContaining({
        command: 'echo ok',
        success: true,
        outcome: 'success',
        client: 'sdk',
        requestedMode: 'local',
        resolvedMode: 'local',
        attachMode: 'local',
        host: 'in-process',
        duration: expect.any(Number),
      }),
    ]);
  });

  it('emits failure when the tool reports bad news', async () => {
    const tools = await createTools({ mode: 'local' });

    await tools.call('echo.bad');

    expect(invocationPayloads()).toEqual([
      expect.objectContaining({
        command: 'echo bad',
        success: false,
        outcome: 'failure',
        client: 'sdk',
      }),
    ]);
  });

  it('does not emit an SDK invocation when the client is the CLI', async () => {
    const tools = await createTools({
      mode: 'local',
      clientInfo: { name: 'storybook-cli', version: '1.2.3', kind: 'cli' },
    });

    await tools.call('echo.ok', { value: 'hello' });

    expect(invocationPayloads()).toEqual([]);
  });

  it('does not emit an SDK invocation from a child host process', async () => {
    vi.stubEnv('STORYBOOK_TOOLS_CHILD_HOST', 'true');
    const tools = await createTools({ mode: 'local' });

    await tools.call('echo.ok', { value: 'hello' });

    expect(invocationPayloads()).toEqual([]);
  });

  it('carries the auto fallback gate on a later SDK call', async () => {
    const attach = vi.fn(async () => {
      throw new AttachUnavailableError({
        reason: 'no-instance',
        instances: [],
        remediation: 'No running Storybook was found for this project.',
      });
    });
    const tools = await createTools({ cwd: '/repo' }, { attach });

    await tools.call('echo.ok', { value: 'hello' });

    expect(invocationPayloads()).toEqual([
      expect.objectContaining({
        command: 'echo ok',
        success: true,
        outcome: 'success',
        client: 'sdk',
        requestedMode: 'auto',
        resolvedMode: 'local',
        attachMode: 'local',
        host: 'in-process',
        attachGate: 'no-instance',
      }),
    ]);
  });

  it('emits attach-gate when attached mode cannot join a running Storybook', async () => {
    const attach = vi.fn(async () => {
      throw new AttachUnavailableError({
        reason: 'connection-failed',
        instances: [],
        remediation: 'Could not connect to the Storybook at http://localhost:6006.',
      });
    });

    await expect(createTools({ mode: 'attached' }, { attach })).rejects.toThrow(
      AttachUnavailableError
    );

    expect(invocationPayloads()).toEqual([
      expect.objectContaining({
        command: '(none)',
        success: false,
        outcome: 'attach-gate',
        client: 'sdk',
        requestedMode: 'attached',
        attachMode: 'attached',
        attachGate: 'connection-failed',
      }),
    ]);
  });

  it('does not emit attach-gate from the CLI client when attached mode throws', async () => {
    const attach = vi.fn(async () => {
      throw new AttachUnavailableError({
        reason: 'no-instance',
        instances: [],
        remediation: 'No running Storybook.',
      });
    });

    await expect(
      createTools(
        {
          mode: 'attached',
          clientInfo: { name: 'storybook-cli', version: '1.2.3', kind: 'cli' },
        },
        { attach }
      )
    ).rejects.toThrow(AttachUnavailableError);

    expect(invocationPayloads()).toEqual([]);
  });

  it('does not emit attach-gate for an unrelated attached-mode failure', async () => {
    const attach = vi.fn(async () => {
      throw new Error('disk full');
    });

    await expect(createTools({ mode: 'attached' }, { attach })).rejects.toThrow('disk full');

    expect(invocationPayloads()).toEqual([]);
  });
});
