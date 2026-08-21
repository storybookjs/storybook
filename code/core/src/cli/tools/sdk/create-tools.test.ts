import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as v from 'valibot';

import { defineToolset } from '../../../shared/open-service/toolset-definition.ts';
import { getToolName } from '../../../shared/open-service/toolset-names.ts';
import { createTools } from './create-tools.ts';
import { AttachUnavailableError, ToolsRuntimeError } from './errors.ts';
import { bootstrapToolsRuntime, type ToolsRuntime } from './local-runtime.ts';

vi.mock('./local-runtime.ts', { spy: true });

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
    sibling: {
      title: 'Point at a sibling',
      description: (ctx) => `See ${getToolName(ctx)('echo.ok')}.`,
      input: v.object({}),
      handler: async () => ({ ok: true as const, data: {}, markdown: '' }),
    },
    slow: {
      title: 'Delay',
      description: 'Resolves after a tick unless aborted.',
      input: v.object({}),
      handler: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { ok: true as const, data: { ran: true }, markdown: 'ran' };
      },
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
    close: async () => {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(bootstrapToolsRuntime).mockReset();
  vi.mocked(bootstrapToolsRuntime).mockResolvedValue(makeRuntime());
});

describe('createTools', () => {
  it('loads the target configuration in this process in local mode', async () => {
    const tools = await createTools({ cwd: '/repo', configDir: '.storybook', mode: 'local' });

    expect(bootstrapToolsRuntime).toHaveBeenCalledWith({ cwd: '/repo', configDir: '.storybook' });
    expect(tools.mode).toBe('local');
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

  it('rejects attached mode as not available yet', async () => {
    await expect(createTools({ mode: 'attached' })).rejects.toThrow(ToolsRuntimeError);
    await expect(createTools({ mode: 'attached' })).rejects.toMatchObject({
      data: { reason: 'mode-unavailable' },
    });
    expect(bootstrapToolsRuntime).not.toHaveBeenCalled();
  });

  it('rejects auto mode, the default, as not available yet', async () => {
    await expect(createTools()).rejects.toMatchObject({ data: { reason: 'mode-unavailable' } });
    await expect(createTools()).rejects.toThrow('`auto` tools mode');
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
      inputSchema: expect.objectContaining({
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
      }),
      outputSchema: expect.objectContaining({ type: 'object' }),
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
      ['echo.sibling', false],
      ['echo.slow', false],
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

    expect(catalog.toolsets[0].methods[0].inputSchema).toBeUndefined();
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

  it('serves no calls once closed', async () => {
    const tools = await createTools({ mode: 'local' });

    await tools.close();

    await expect(tools.call('echo.ok', { value: 'hello' })).rejects.toMatchObject({
      data: { reason: 'closed' },
    });
    await expect(tools.describe()).rejects.toMatchObject({ data: { reason: 'closed' } });
  });

  it('describes sibling tools with dotted refs for the SDK and CLI wording for the CLI', async () => {
    const sdk = await createTools({ mode: 'local' });
    const cli = await createTools({
      mode: 'local',
      clientInfo: { name: 'storybook-cli', version: '1.2.3', kind: 'cli' },
    });

    const sdkCatalog = await sdk.describe();
    const cliCatalog = await cli.describe();
    const siblingOf = (catalog: Awaited<ReturnType<typeof sdk.describe>>) =>
      catalog.toolsets[0].methods.find((method) => method.ref === 'echo.sibling')?.description;

    expect(siblingOf(sdkCatalog)).toBe('See echo.ok.');
    expect(siblingOf(cliCatalog)).toBe('See npx storybook tools echo ok.');
  });

  it('rejects prototype-named refs as unknown methods', async () => {
    const tools = await createTools({ mode: 'local' });

    await expect(tools.call('echo.constructor')).rejects.toMatchObject({
      data: { reason: 'unknown-method' },
    });
  });

  it('rejects when the signal aborts after the handler has started', async () => {
    const tools = await createTools({ mode: 'local' });
    const controller = new AbortController();
    const pending = tools.call('echo.slow', {}, { signal: controller.signal });

    controller.abort();

    await expect(pending).rejects.toThrow();
  });

  it('disposes the local runtime once, even if close is called twice', async () => {
    const close = vi.fn(async () => {});
    vi.mocked(bootstrapToolsRuntime).mockResolvedValue(makeRuntime({ close }));
    const tools = await createTools({ mode: 'local' });

    await tools.close();
    await tools.close();

    expect(close).toHaveBeenCalledOnce();
  });
});
