import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolve } from 'node:path';

import { loadStorybookAiMetadata, type StorybookAiMetadata } from './local-metadata.ts';
import { readRegistry } from '../../tools/instances/registry.ts';
import { createTools } from '../../tools/sdk/create-tools.ts';
import {
  AttachUnavailableError,
  ToolsRuntimeError,
  type AttachedTools,
  type ToolsetCatalog,
} from '../../tools/sdk/index.ts';
import { buildStorybookCommandsHelp, runAiTool, runAiToolHelp } from './run-tool.ts';
import type { StorybookInstanceRecord } from '../../tools/instances/types.ts';

vi.mock('../../tools/instances/registry.ts', { spy: true });
vi.mock('../../tools/sdk/create-tools.ts', { spy: true });
vi.mock('./local-metadata.ts', { spy: true });

const record: StorybookInstanceRecord = {
  schemaVersion: 1,
  instanceId: 'inst-1',
  pid: 1,
  cwd: '/projects/foo',
  url: 'http://localhost:6006',
  port: 6006,
  mcp: { status: 'ready', endpoint: '/mcp' },
};

const defaultRuntimeMetadata: StorybookAiMetadata = {
  instructions: 'Follow the story workflow.',
  tools: [
    { name: 'docs-list', description: 'List docs' },
    { name: 'docs-show', description: 'Get docs.' },
  ],
};

const defaultCatalog: ToolsetCatalog = {
  configDir: '/projects/foo/.storybook',
  toolsets: [
    {
      id: 'docs',
      description: 'Docs',
      methods: [
        {
          ref: 'docs.list',
          title: 'List docs',
          description: 'List docs',
          requiresDevServer: true,
          inputSchema: undefined,
        },
        {
          ref: 'docs.show',
          title: 'Get docs',
          description: 'Get docs.',
          requiresDevServer: true,
          inputSchema: undefined,
        },
      ],
    },
  ],
};

function makeAttachedTools(): AttachedTools & {
  call: ReturnType<typeof vi.fn>;
  describe: ReturnType<typeof vi.fn>;
} {
  const call = vi.fn(async () => ({ ok: true as const, data: {}, markdown: 'upstream result' }));
  const describe = vi.fn(async () => defaultCatalog);
  return {
    mode: 'attached',
    clientInfo: { name: 'storybook-cli', version: '0.0.0', kind: 'cli' },
    runtime: {
      configDir: '/projects/foo/.storybook',
      toolsets: [],
      getService: () => {
        throw new Error('no services registered in this test');
      },
    },
    storybook: {
      version: '0.0.0',
      configDir: '/projects/foo/.storybook',
      url: 'http://localhost:6006',
      pid: 1,
    },
    describe,
    call,
    close: vi.fn(async () => {}),
  };
}

let toolsHost: ReturnType<typeof makeAttachedTools>;

beforeEach(() => {
  vi.mocked(readRegistry).mockReset().mockResolvedValue([record]);
  toolsHost = makeAttachedTools();
  vi.mocked(createTools)
    .mockReset()
    .mockImplementation(async () => toolsHost);
  vi.mocked(loadStorybookAiMetadata).mockReset().mockResolvedValue(defaultRuntimeMetadata);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('runAiTool', () => {
  it('forwards the call to the matching instance and prints the markdown result', async () => {
    const result = await runAiTool('docs-list', ['--withStoryIds', 'true'], {
      cwd: '/projects/foo',
    });

    expect(createTools).toHaveBeenCalledWith({
      cwd: '/projects/foo',
      configDir: undefined,
      port: 6006,
      mode: 'attached',
      autoSpawn: false,
      clientInfo: { name: 'storybook-cli', version: expect.any(String), kind: 'cli' },
    });
    expect(toolsHost.call).toHaveBeenCalledWith(
      'docs.list',
      { withStoryIds: true },
      { origin: 'http://localhost:6006' }
    );
    expect(toolsHost.close).toHaveBeenCalledOnce();
    expect(result).toEqual({
      exitCode: 0,
      output: 'upstream result',
      outcome: { kind: 'success' },
    });
    expect(loadStorybookAiMetadata).toHaveBeenCalledWith({
      cwd: resolve('/projects/foo'),
      configDir: resolve('/projects/foo/.storybook'),
    });
  });

  it('runs local tools from Storybook AI metadata without contacting the running Storybook', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'get-storybook-story-instructions', description: 'Get story guidance' }],
      localTools: {
        'get-storybook-story-instructions': {
          call: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'local story instructions' }],
          }),
        },
      },
    });

    const result = await runAiTool('get-storybook-story-instructions', [], {
      cwd: '/projects/foo',
    });

    expect(result).toEqual({
      exitCode: 0,
      output: 'local story instructions',
      outcome: { kind: 'success' },
    });
    expect(readRegistry).not.toHaveBeenCalled();
    expect(createTools).not.toHaveBeenCalled();
  });

  it('runs any metadata-declared local tool locally even when a Storybook server is ready', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'custom-local-command', description: 'Run custom local work' }],
      localTools: {
        'custom-local-command': {
          call: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'custom local result' }],
          }),
        },
      },
    });

    const result = await runAiTool('custom-local-command', [], {
      cwd: '/projects/foo',
    });

    expect(result.output).toBe('custom local result');
    expect(readRegistry).not.toHaveBeenCalled();
    expect(createTools).not.toHaveBeenCalled();
  });

  it('loads known local tools from a custom config dir option', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'get-storybook-story-instructions', description: 'Get story guidance' }],
      localTools: {
        'get-storybook-story-instructions': {
          call: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'custom config instructions' }],
          }),
        },
      },
    });

    const result = await runAiTool('get-storybook-story-instructions', [], {
      cwd: '/projects/foo',
      configDir: 'config/storybook',
    });

    expect(result.output).toBe('custom config instructions');
    expect(loadStorybookAiMetadata).toHaveBeenCalledWith({
      cwd: resolve('/projects/foo'),
      configDir: resolve('/projects/foo/config/storybook'),
    });
    expect(readRegistry).not.toHaveBeenCalled();
  });

  it('ignores --port validation for metadata-declared local tools', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'get-storybook-story-instructions', description: 'Get story guidance' }],
      localTools: {
        'get-storybook-story-instructions': {
          call: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'local story instructions' }],
          }),
        },
      },
    });

    const result = await runAiTool('get-storybook-story-instructions', ['--port', 'abc'], {
      cwd: '/projects/foo',
    });

    expect(result).toEqual({
      exitCode: 0,
      output: 'local story instructions',
      outcome: { kind: 'success' },
    });
    expect(readRegistry).not.toHaveBeenCalled();
  });

  it('surfaces metadata loading errors before checking for a server', async () => {
    vi.mocked(loadStorybookAiMetadata).mockRejectedValue(new Error('main config failed'));

    const result = await runAiTool('get-storybook-story-instructions', [], {
      cwd: '/projects/foo',
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Storybook command metadata is unavailable');
    expect(result.output).toContain('main config failed');
    expect(result.outcome).toEqual({
      kind: 'error',
      error: expect.objectContaining({ name: 'LocalAiToolError' }),
    });
    expect(readRegistry).not.toHaveBeenCalled();
    expect(createTools).not.toHaveBeenCalled();
  });

  it('surfaces local tool error results with the stable MCP error wrapper', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'get-storybook-story-instructions', description: 'Get story guidance' }],
      localTools: {
        'get-storybook-story-instructions': {
          call: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'local failure' }],
            isError: true,
          }),
        },
      },
    });

    const result = await runAiTool('get-storybook-story-instructions', [], {
      cwd: '/projects/foo',
    });

    expect(result).toEqual({
      exitCode: 1,
      output: 'local failure',
      outcome: { kind: 'error', error: expect.objectContaining({ name: 'McpToolResultError' }) },
    });
  });

  it('wraps thrown local tool errors with a stable local command error', async () => {
    const error = new Error('local command exploded');
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'get-storybook-story-instructions', description: 'Get story guidance' }],
      localTools: {
        'get-storybook-story-instructions': {
          call: vi.fn().mockRejectedValue(error),
        },
      },
    });

    const result = await runAiTool('get-storybook-story-instructions', [], {
      cwd: '/projects/foo',
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toBe('local command exploded');
    expect(result.outcome).toEqual({
      kind: 'error',
      error: expect.objectContaining({ name: 'LocalAiToolError', cause: error }),
    });
  });

  it('routes via the recorded configDir when the dev server was started from the monorepo root', async () => {
    const rootInstance = {
      ...record,
      cwd: resolve('/repo'),
      configDir: resolve('/repo/packages/ui/.storybook'),
    };
    vi.mocked(readRegistry).mockResolvedValue([rootInstance]);

    const result = await runAiTool('docs-list', [], { cwd: '/repo/packages/ui' });

    expect(createTools).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: resolve('/repo'),
        configDir: resolve('/repo/packages/ui/.storybook'),
        port: 6006,
        mode: 'attached',
      })
    );
    expect(toolsHost.call).toHaveBeenCalledWith(
      'docs.list',
      {},
      { origin: 'http://localhost:6006' }
    );
    expect(result.exitCode).toBe(0);
  });

  it('routes via --config-dir from the monorepo root when the dev server was started from the leaf', async () => {
    const leafInstance = {
      ...record,
      cwd: resolve('/repo/packages/ui'),
      configDir: resolve('/repo/packages/ui/.storybook'),
    };
    vi.mocked(readRegistry).mockResolvedValue([leafInstance]);

    const result = await runAiTool('docs-list', [], {
      cwd: '/repo',
      configDir: 'packages/ui/.storybook',
    });

    expect(createTools).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: resolve('/repo/packages/ui'),
        configDir: resolve('/repo/packages/ui/.storybook'),
        port: 6006,
        mode: 'attached',
      })
    );
    expect(toolsHost.call).toHaveBeenCalledWith(
      'docs.list',
      {},
      { origin: 'http://localhost:6006' }
    );
    expect(result.exitCode).toBe(0);
  });

  it('defaults the cwd to process.cwd()', async () => {
    vi.mocked(readRegistry).mockResolvedValue([{ ...record, cwd: process.cwd() }]);
    const result = await runAiTool('docs-list', []);
    expect(result.exitCode).toBe(0);
  });

  it('merges --json arguments with --key overrides', async () => {
    await runAiTool('docs-show', ['--id', 'override'], {
      cwd: '/projects/foo',
      json: '{"id":"base","verbose":true}',
    });

    expect(toolsHost.call).toHaveBeenCalledWith(
      'docs.show',
      { id: 'override', verbose: true },
      { origin: 'http://localhost:6006' }
    );
  });

  it('forwards storybookId so composition docs-show addresses the named source', async () => {
    await runAiTool('docs-show', ['--id', 'button', '--storybookId', 'design-system'], {
      cwd: '/projects/foo',
    });

    expect(toolsHost.call).toHaveBeenCalledWith(
      'docs.show',
      { id: 'button', storybookId: 'design-system' },
      { origin: 'http://localhost:6006' }
    );
  });

  it('threads the per-method telemetry sink through the SDK call', async () => {
    const methodTelemetry = vi.fn(async () => {});

    await runAiTool('docs-list', [], { cwd: '/projects/foo' }, { methodTelemetry });

    expect(toolsHost.call).toHaveBeenCalledWith(
      'docs.list',
      {},
      expect.objectContaining({ origin: 'http://localhost:6006', telemetry: methodTelemetry })
    );
  });

  it('returns the arg-parsing error without contacting the registry', async () => {
    const result = await runAiTool('docs-show', ['positional'], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unexpected argument');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
    expect(readRegistry).not.toHaveBeenCalled();
  });

  it('prints the no-instance repair markdown and exits non-zero when nothing runs at the cwd', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'docs-show', description: 'Get docs.' }],
    });

    const result = await runAiTool('docs-show', [], { cwd: '/projects/other' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('No running Storybook matches this project');
    expect(result.output).toContain('- cwd `/projects/foo` (http://localhost:6006)');
    expect(result.output).toContain('- `storybook ai --cwd /projects/foo <command> [args...]`');
    expect(result.output).toContain('BEFORE the command name');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'no-instance' });
    expect(createTools).not.toHaveBeenCalled();
  });

  it('includes a --config-dir retry example in the no-instance markdown when recorded', async () => {
    vi.mocked(readRegistry).mockResolvedValue([
      { ...record, cwd: '/repo', configDir: '/repo/packages/ui/.storybook' },
    ]);

    const result = await runAiTool('docs-show', [], { cwd: '/projects/other' });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(
      '- cwd `/repo`, config dir `/repo/packages/ui/.storybook` (http://localhost:6006)'
    );
    expect(result.output).toContain(
      '- `storybook ai --config-dir /repo/packages/ui/.storybook <command> [args...]`'
    );
    expect(result.output).not.toContain('storybook ai --cwd');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'no-instance' });
  });

  it('does not route by cwd when an explicit --config-dir targets a different config', async () => {
    vi.mocked(readRegistry).mockResolvedValue([
      { ...record, cwd: resolve('/repo'), configDir: resolve('/repo/.storybook') },
    ]);

    const result = await runAiTool('docs-list', [], {
      cwd: '/repo',
      configDir: 'packages/ui/.storybook',
    });

    expect(createTools).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'no-instance' });
  });

  it('prints metadata upgrade guidance when no metadata exists even if a server is ready', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue(undefined);

    const result = await runAiTool('get-storybook-story-instructions', [], {
      cwd: '/projects/foo',
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Storybook command metadata is unavailable');
    expect(result.output).toContain('@storybook/addon-mcp');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'addon-missing' });
    expect(readRegistry).not.toHaveBeenCalled();
    expect(createTools).not.toHaveBeenCalled();
  });

  it('routes to the instance on the requested --port when several share the cwd', async () => {
    const onOtherPort = { ...record, instanceId: 'inst-2', pid: 2, port: 6007 };
    vi.mocked(readRegistry).mockResolvedValue([record, onOtherPort]);
    const result = await runAiTool('docs-list', [], {
      cwd: '/projects/foo',
      port: '6007',
    });
    expect(createTools).toHaveBeenCalledWith(
      expect.objectContaining({ port: 6007, mode: 'attached' })
    );
    expect(result.exitCode).toBe(0);
  });

  it('prints the port-mismatch repair markdown when no instance at the cwd is on the port', async () => {
    const result = await runAiTool('docs-list', [], {
      cwd: '/projects/foo',
      port: '9999',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('not on port `9999`');
    expect(result.output).toContain('- port `6006`');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'port-mismatch' });
    expect(createTools).not.toHaveBeenCalled();
  });

  it('rejects an invalid --port without contacting the registry', async () => {
    const result = await runAiTool('docs-list', [], {
      cwd: '/projects/foo',
      port: 'abc',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('`--port` must be a port number');
    expect(readRegistry).not.toHaveBeenCalled();
  });

  it.each([
    ['starting', 'still starting up', 'mcp-starting'],
    ['not-installed', '`@storybook/addon-mcp` addon is missing', 'addon-missing'],
    ['error', 'Inspect the Storybook terminal output', 'mcp-error'],
  ] as const)('prints the repair markdown for mcp.status=%s', async (status, expected, reason) => {
    vi.mocked(readRegistry).mockResolvedValue([{ ...record, mcp: { status } }]);
    const result = await runAiTool('docs-show', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(expected);
    expect(result.outcome).toEqual({ kind: 'intercept', reason });
    expect(createTools).not.toHaveBeenCalled();
  });

  it('prints a placeholder when the tool returns no content', async () => {
    toolsHost.call.mockResolvedValue({ ok: true, data: {}, markdown: '' });
    const result = await runAiTool('docs-list', [], { cwd: '/projects/foo' });
    expect(result).toEqual({
      exitCode: 0,
      output: '(the command returned no content)',
      outcome: { kind: 'success' },
    });
  });

  it('surfaces the SDK message when attach fails after a ready record is resolved', async () => {
    vi.mocked(createTools).mockRejectedValue(
      new AttachUnavailableError({
        reason: 'old-server',
        instances: [record],
        remediation: 'Restart Storybook (v10.2.0+) to enable attach.',
      })
    );
    const result = await runAiTool('docs-list', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Restart Storybook');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'attach-unavailable' });
  });

  it('joins multi-block markdown from the SDK', async () => {
    toolsHost.call.mockResolvedValue({
      ok: true,
      data: {},
      markdown: ['intro', 'more'],
    });
    const result = await runAiTool('docs-show', [], { cwd: '/projects/foo' });
    expect(result.output).toBe('intro\n\nmore');
  });

  it('does not call the running Storybook for commands hidden by preset metadata', async () => {
    const result = await runAiTool('test-run', [], { cwd: '/projects/foo' });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unknown command `test-run`');
    expect(result.output).toContain('- `docs-list`');
    expect(result.output).not.toContain('- `test-run`');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'unknown-command' });
    expect(readRegistry).not.toHaveBeenCalled();
    expect(createTools).not.toHaveBeenCalled();
  });

  it('lists the server tools when a metadata-visible runtime command is missing server-side', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      ...defaultRuntimeMetadata,
      tools: [...defaultRuntimeMetadata.tools, { name: 'no-such-tool', description: 'Stale tool' }],
    });
    toolsHost.call.mockRejectedValue(
      new ToolsRuntimeError({
        reason: 'unknown-method',
        message: 'Unknown tool `docs.noSuchTool`.',
      })
    );

    const result = await runAiTool('no-such-tool', [], { cwd: '/projects/foo' });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unknown command `no-such-tool`');
    expect(result.output).toContain('- `docs-list`');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'unknown-command' });
  });

  it('keeps the original error result when the failing tool does exist', async () => {
    toolsHost.call.mockResolvedValue({
      ok: false,
      data: {},
      markdown: 'tests failed',
    });
    const result = await runAiTool('docs-list', [], { cwd: '/projects/foo' });
    expect(result).toEqual({
      exitCode: 1,
      output: 'tests failed',
      outcome: { kind: 'error', error: expect.objectContaining({ name: 'McpToolResultError' }) },
    });
    const error = (result.outcome as { error: Error }).error;
    expect(error.message).toBe('The Storybook AI command returned an error result');
    expect(error.cause).toBe('tests failed');
  });

  it('prints the original runtime error when the tool exists', async () => {
    const error = new ToolsRuntimeError({
      reason: 'invalid-input',
      message: 'Invalid input for `docs.list`',
    });
    toolsHost.call.mockRejectedValue(error);
    const result = await runAiTool('docs-list', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Invalid input for `docs.list`');
    expect(result.outcome).toEqual({ kind: 'error', error });
  });

  it('prints the original runtime error when the catalog cannot be fetched', async () => {
    const error = new ToolsRuntimeError({
      reason: 'unknown-method',
      message: 'Unknown tool `docs.noSuchTool`.',
    });
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      ...defaultRuntimeMetadata,
      tools: [...defaultRuntimeMetadata.tools, { name: 'no-such-tool', description: 'Stale tool' }],
    });
    toolsHost.call.mockRejectedValue(error);
    toolsHost.describe.mockRejectedValue(new Error('boom'));
    const result = await runAiTool('no-such-tool', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unknown tool `docs.noSuchTool`');
    expect(result.outcome).toEqual({ kind: 'error', error });
  });

  it('surfaces a friendly error when attach cannot reach the running Storybook', async () => {
    const error = new AttachUnavailableError({
      reason: 'connection-failed',
      instances: [record],
      remediation: `Could not connect to the Storybook at ${record.url}.`,
    });
    vi.mocked(createTools).mockRejectedValue(error);
    const result = await runAiTool('docs-show', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Could not connect to the Storybook at http://localhost:6006');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'attach-unavailable' });
  });

  it('prepends a warning when multiple instances run at the same cwd', async () => {
    const sibling = { ...record, instanceId: 'inst-2', pid: 2, url: 'http://localhost:6007' };
    vi.mocked(readRegistry).mockResolvedValue([record, sibling]);
    const result = await runAiTool('docs-list', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Multiple Storybook instances match this project');
    expect(result.output).toContain('cwd `/projects/foo`');
    expect(result.output).toContain('pid `1`');
    expect(result.output).toContain('pid `2`');
    expect(result.output).toContain('(used)');
    expect(result.output).toContain('upstream result');
  });

  describe('when multiple instances exist in the selected agent bucket', () => {
    const olderPreview = {
      ...record,
      agent: 'claude-preview',
      instanceId: 'inst-2',
      pid: 2,
      port: 6007,
      startedAt: '2026-06-09T10:00:00.000Z',
      url: 'http://localhost:6007',
    };
    const selectedPreview = {
      ...record,
      agent: 'claude-preview',
      instanceId: 'inst-3',
      pid: 3,
      port: 6008,
      startedAt: '2026-06-09T11:00:00.000Z',
      url: 'http://localhost:6008',
    };
    const newerCodex = {
      ...record,
      agent: 'codex',
      instanceId: 'inst-4',
      pid: 4,
      port: 6009,
      startedAt: '2026-06-09T12:00:00.000Z',
      url: 'http://localhost:6009',
    };

    beforeEach(() => {
      vi.stubEnv('AI_AGENT', 'claude');
      vi.mocked(readRegistry).mockResolvedValue([olderPreview, selectedPreview, newerCodex]);
    });

    it('only warns about instances in the selected agent bucket', async () => {
      const result = await runAiTool('docs-list', [], { cwd: '/projects/foo' });

      expect(createTools).toHaveBeenCalledWith(
        expect.objectContaining({ port: 6008, mode: 'attached' })
      );
      expect(toolsHost.call).toHaveBeenCalledWith(
        'docs.list',
        {},
        { origin: 'http://localhost:6006' }
      );
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Multiple Storybook instances match this project');
      expect(result.output).toContain('cwd `/projects/foo`');
      expect(result.output).toContain('pid `2`');
      expect(result.output).toContain('pid `3`');
      expect(result.output).not.toContain('pid `4`');
      expect(result.output).not.toContain('http://localhost:6009');
    });
  });
});

describe('buildStorybookCommandsHelp', () => {
  it('lists each tool with the first line of its description', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      tools: [
        {
          name: 'docs-show',
          description: 'Get docs for a component.\n\nLong details that should not appear.',
        },
        { name: 'docs-list' },
        { name: 'get-storybook-story-instructions', description: 'Get story guidance.' },
      ],
      localTools: {
        'get-storybook-story-instructions': {
          call: vi.fn().mockResolvedValue({ content: [] }),
        },
      },
      instructions: 'Follow the story workflow.',
    });

    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain(
      `Storybook help from the Storybook configuration at ${resolve('/projects/foo/.storybook')}:`
    );
    expect(section).toContain('# Storybook commands');
    expect(section).toContain('docs-show');
    expect(section).toContain('[requires Storybook] Get docs for a component.');
    expect(section).toContain('get-storybook-story-instructions  [local]');
    expect(section).toContain('Get docs for a component.');
    expect(section).not.toContain('Long details');
    expect(section).toContain("Run 'storybook ai <command> --help'");
    expect(readRegistry).not.toHaveBeenCalled();
  });

  it('prints workflow instructions before the dynamic commands list', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      tools: [{ name: 'docs-show', description: 'Get docs for a component.' }],
      instructions: 'Use existing stories as examples.\nRun tests after writing stories.',
    });

    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toBe(
      [
        `Storybook help from the Storybook configuration at ${resolve('/projects/foo/.storybook')}:`,
        '',
        '# Storybook workflow instructions',
        '',
        'Use existing stories as examples.',
        'Run tests after writing stories.',
        '',
        '# Storybook commands',
        '',
        '  docs-show  [requires Storybook] Get docs for a component.',
        '',
        '[local] commands run from configuration metadata without a running Storybook.',
        '[requires Storybook] commands are forwarded to the running Storybook server.',
        '',
        "Run 'storybook ai <command> --help' for a command's description and arguments.",
      ].join('\n')
    );
  });

  it('degrades to a note when the metadata preset is unavailable', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue(undefined);
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain('Storybook commands: (unavailable');
    expect(section).toContain('does not expose AI command metadata');
    expect(section).toContain('@storybook/addon-mcp');
  });

  it('degrades to a note when metadata loading fails', async () => {
    vi.mocked(loadStorybookAiMetadata).mockRejectedValue(new Error('main config failed'));
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain('Storybook commands: (unavailable');
    expect(section).toContain('could not be loaded');
  });

  it('degrades to a note when no tools are exposed', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      tools: [],
      instructions: '',
    });
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain('provides no commands');
  });

  it('still lists commands when workflow instructions are absent', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      tools: [{ name: 'docs-show', description: 'Get docs for a component.' }],
      instructions: '   ',
    });
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain('# Storybook commands');
    expect(section).toContain('docs-show');
    expect(section).not.toContain('# Storybook workflow instructions');
  });

  it('ignores --port on the serverless help path', async () => {
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo', port: 'abc' });
    expect(section).toContain('Storybook help from the Storybook configuration');
    expect(section).toContain('docs-list');
    expect(loadStorybookAiMetadata).toHaveBeenCalledWith({
      cwd: resolve('/projects/foo'),
      configDir: resolve('/projects/foo/.storybook'),
    });
  });

  it('loads the command section from a custom config dir', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      tools: [{ name: 'docs-show', description: 'Get docs for a component.' }],
      instructions: 'Follow the story workflow.',
    });

    const section = await buildStorybookCommandsHelp({
      cwd: '/projects/foo',
      configDir: 'config/storybook',
    });

    expect(section).toContain('docs-show');
    expect(loadStorybookAiMetadata).toHaveBeenCalledWith({
      cwd: resolve('/projects/foo'),
      configDir: resolve('/projects/foo/config/storybook'),
    });
  });
});

describe('runAiToolHelp', () => {
  it('prints the description and arguments of a single tool', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [
        {
          name: 'docs-show',
          description: 'Get docs for a component.',
          inputSchema: {
            properties: { id: { type: 'string', description: 'Documentation id' } },
            required: ['id'],
          },
        },
      ],
    });

    const result = await runAiToolHelp('docs-show', { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage: storybook ai docs-show');
    expect(result.output).toContain('Get docs for a component.');
    expect(result.output).toContain('Execution: requires a running Storybook.');
    expect(result.output).toContain('- `--id` (string, required): Documentation id');
    expect(result.outcome).toEqual({ kind: 'help' });
  });

  it('recurses into array item and object property schemas so nested fields self-document', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [
        {
          name: 'review-create',
          description: 'Publish a review.',
          inputSchema: {
            properties: {
              collections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'What the group is' },
                    storyIds: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'IDs the group renders',
                    },
                  },
                  required: ['title', 'storyIds'],
                },
              },
              changedFiles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Paths you changed',
              },
            },
            required: ['collections', 'changedFiles'],
          },
        },
      ],
    });

    const result = await runAiToolHelp('review-create', { cwd: '/projects/foo' });

    expect(result.exitCode).toBe(0);
    expect(result.output).toMatchInlineSnapshot(`
      "Usage: storybook ai review-create [--key value ...]

      Publish a review.

      Execution: requires a running Storybook.

      Arguments:
      - \`--collections\` (array of object, required)
        each item:
          - \`title\` (string, required): What the group is
          - \`storyIds\` (array of string, required): IDs the group renders
      - \`--changedFiles\` (array of string, required): Paths you changed"
    `);
  });

  it('describes anyOf/oneOf union variants in help', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [
        {
          name: 'stories-preview',
          description: 'Preview stories.',
          inputSchema: {
            properties: {
              stories: {
                type: 'array',
                items: {
                  anyOf: [
                    {
                      type: 'object',
                      properties: { storyId: { type: 'string', description: 'A story id' } },
                      required: ['storyId'],
                    },
                    {
                      type: 'object',
                      properties: {
                        exportName: { type: 'string', description: 'An export name' },
                      },
                      required: ['exportName'],
                    },
                  ],
                },
                description: 'Stories to preview',
              },
            },
            required: ['stories'],
          },
        },
      ],
    });

    const result = await runAiToolHelp('stories-preview', { cwd: '/projects/foo' });

    expect(result.exitCode).toBe(0);
    expect(result.output).toMatchInlineSnapshot(`
      "Usage: storybook ai stories-preview [--key value ...]

      Preview stories.

      Execution: requires a running Storybook.

      Arguments:
      - \`--stories\` (array, required): Stories to preview
        each item:
          option 1
            - \`storyId\` (string, required): A story id
          option 2
            - \`exportName\` (string, required): An export name"
    `);
  });

  it('falls back to the top-level type and description when an argument schema cannot be modeled', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [
        {
          name: 'exotic-tool',
          description: 'Has an unmodeled schema.',
          inputSchema: {
            properties: {
              weird: { type: 'string', description: 'An odd one', items: false },
            },
            required: ['weird'],
          },
        },
      ],
    });

    const result = await runAiToolHelp('exotic-tool', { cwd: '/projects/foo' });

    expect(result.exitCode).toBe(0);
    expect(result.output).toMatchInlineSnapshot(`
      "Usage: storybook ai exotic-tool [--key value ...]

      Has an unmodeled schema.

      Execution: requires a running Storybook.

      Arguments:
      - \`--weird\` (string, required): An odd one"
    `);
  });

  it('marks local commands in single-command help', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'get-storybook-story-instructions', description: 'Get story guidance.' }],
      localTools: {
        'get-storybook-story-instructions': {
          call: vi.fn().mockResolvedValue({ content: [] }),
        },
      },
    });

    const result = await runAiToolHelp('get-storybook-story-instructions', {
      cwd: '/projects/foo',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Execution: local (no running Storybook required).');
  });

  it('is reachable through runAiTool via a --help token after the tool name', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'docs-show', description: 'Get docs.' }],
    });
    const result = await runAiTool('docs-show', ['--help'], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage: storybook ai docs-show');
    expect(result.outcome).toEqual({ kind: 'help' });
    expect(createTools).not.toHaveBeenCalled();
    expect(readRegistry).not.toHaveBeenCalled();
  });

  it('honors the config dir option on the help path after the tool name', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'docs-show', description: 'Get docs.' }],
    });
    const result = await runAiTool('docs-show', ['--help'], {
      cwd: '/projects/foo',
      configDir: 'config/storybook',
    });
    expect(result.exitCode).toBe(0);
    expect(loadStorybookAiMetadata).toHaveBeenCalledWith({
      cwd: resolve('/projects/foo'),
      configDir: resolve('/projects/foo/config/storybook'),
    });
  });

  it('ignores --port tokens on the help path without needing a running server', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'docs-show', description: 'Get docs.' }],
    });
    const result = await runAiTool('docs-show', ['--port', 'not-a-port', '--help'], {
      cwd: '/projects/foo',
    });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage: storybook ai docs-show');
    expect(readRegistry).not.toHaveBeenCalled();
  });

  it('lists the available tools for an unknown tool name', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'docs-list', description: 'List docs' }],
    });
    const result = await runAiToolHelp('no-such-tool', { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unknown command `no-such-tool`');
    expect(result.output).toContain('- `docs-list`');
  });

  it('prints metadata unavailable guidance when no preset metadata is exposed', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue(undefined);
    const result = await runAiToolHelp('docs-show', { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Storybook command metadata is unavailable');
    expect(result.output).toContain('@storybook/addon-mcp');
    expect(result.outcome).toEqual({ kind: 'help' });
  });

  it('ignores an invalid --port on direct help lookup', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'docs-show', description: 'Get docs.' }],
    });

    const result = await runAiToolHelp('docs-show', {
      cwd: '/projects/foo',
      port: 'abc',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage: storybook ai docs-show');
  });

  it('loads direct help from a custom config dir', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'docs-show', description: 'Get docs.' }],
    });

    const result = await runAiToolHelp('docs-show', {
      cwd: '/projects/foo',
      configDir: 'config/storybook',
    });

    expect(result.exitCode).toBe(0);
    expect(loadStorybookAiMetadata).toHaveBeenCalledWith({
      cwd: resolve('/projects/foo'),
      configDir: resolve('/projects/foo/config/storybook'),
    });
  });

  it('surfaces metadata loading errors', async () => {
    vi.mocked(loadStorybookAiMetadata).mockRejectedValue(new Error('main config failed'));
    const result = await runAiToolHelp('docs-show', { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Storybook command metadata is unavailable');
    expect(result.output).toContain('main config failed');
  });
});
