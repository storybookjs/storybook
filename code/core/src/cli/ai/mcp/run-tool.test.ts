import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolve } from 'node:path';
import { McpJsonRpcError, callMcpTool, listMcpTools } from './client.ts';
import { loadStorybookAiMetadata, type StorybookAiMetadata } from './local-metadata.ts';
import { readRegistry } from './registry.ts';
import { buildStorybookCommandsHelp, runAiTool, runAiToolHelp } from './run-tool.ts';
import type { StorybookInstanceRecord } from './types.ts';

vi.mock('./registry.ts', { spy: true });
vi.mock('./client.ts', { spy: true });
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
    { name: 'list-all-documentation', description: 'List docs' },
    { name: 'get-documentation', description: 'Get docs.' },
  ],
};

beforeEach(() => {
  vi.mocked(readRegistry).mockReset().mockResolvedValue([record]);
  vi.mocked(callMcpTool)
    .mockReset()
    .mockResolvedValue({ content: [{ type: 'text', text: 'upstream result' }] });
  vi.mocked(listMcpTools)
    .mockReset()
    .mockResolvedValue([{ name: 'list-all-documentation', description: 'List docs' }]);
  vi.mocked(loadStorybookAiMetadata).mockReset().mockResolvedValue(defaultRuntimeMetadata);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('runAiTool', () => {
  it('forwards the call to the matching instance and prints the markdown result', async () => {
    const result = await runAiTool('list-all-documentation', ['--withStoryIds', 'true'], {
      cwd: '/projects/foo',
    });

    expect(callMcpTool).toHaveBeenCalledWith(
      record,
      { name: 'list-all-documentation', arguments: { withStoryIds: true } },
      undefined
    );
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

  it('runs local tools from Storybook AI metadata without contacting the MCP server', async () => {
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
    expect(callMcpTool).not.toHaveBeenCalled();
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
    expect(callMcpTool).not.toHaveBeenCalled();
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
    expect(callMcpTool).not.toHaveBeenCalled();
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

    const result = await runAiTool('list-all-documentation', [], { cwd: '/repo/packages/ui' });

    expect(callMcpTool).toHaveBeenCalledWith(rootInstance, expect.anything(), undefined);
    expect(result.exitCode).toBe(0);
  });

  it('routes via --config-dir from the monorepo root when the dev server was started from the leaf', async () => {
    const leafInstance = {
      ...record,
      cwd: resolve('/repo/packages/ui'),
      configDir: resolve('/repo/packages/ui/.storybook'),
    };
    vi.mocked(readRegistry).mockResolvedValue([leafInstance]);

    const result = await runAiTool('list-all-documentation', [], {
      cwd: '/repo',
      configDir: 'packages/ui/.storybook',
    });

    expect(callMcpTool).toHaveBeenCalledWith(leafInstance, expect.anything(), undefined);
    expect(result.exitCode).toBe(0);
  });

  it('defaults the cwd to process.cwd()', async () => {
    vi.mocked(readRegistry).mockResolvedValue([{ ...record, cwd: process.cwd() }]);
    const result = await runAiTool('list-all-documentation', []);
    expect(result.exitCode).toBe(0);
  });

  it('merges --json arguments with --key overrides', async () => {
    await runAiTool('get-documentation', ['--id', 'override'], {
      cwd: '/projects/foo',
      json: '{"id":"base","verbose":true}',
    });

    expect(callMcpTool).toHaveBeenCalledWith(
      record,
      { name: 'get-documentation', arguments: { id: 'override', verbose: true } },
      undefined
    );
  });

  it('returns the arg-parsing error without contacting the registry', async () => {
    const result = await runAiTool('get-documentation', ['positional'], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unexpected argument');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
    expect(readRegistry).not.toHaveBeenCalled();
  });

  it('prints the no-instance repair markdown and exits non-zero when nothing runs at the cwd', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'get-documentation', description: 'Get docs.' }],
    });

    const result = await runAiTool('get-documentation', [], { cwd: '/projects/other' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('No running Storybook matches this project');
    expect(result.output).toContain('- cwd `/projects/foo` (http://localhost:6006)');
    expect(result.output).toContain('- `storybook ai --cwd /projects/foo <command> [args...]`');
    expect(result.output).toContain('BEFORE the command name');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'no-instance' });
  });

  it('includes a --config-dir retry example in the no-instance markdown when recorded', async () => {
    vi.mocked(readRegistry).mockResolvedValue([
      { ...record, cwd: '/repo', configDir: '/repo/packages/ui/.storybook' },
    ]);

    const result = await runAiTool('get-documentation', [], { cwd: '/projects/other' });

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
    // Only the root Storybook runs; the agent explicitly targets the (not running) ui package.
    vi.mocked(readRegistry).mockResolvedValue([
      { ...record, cwd: resolve('/repo'), configDir: resolve('/repo/.storybook') },
    ]);

    const result = await runAiTool('list-all-documentation', [], {
      cwd: '/repo',
      configDir: 'packages/ui/.storybook',
    });

    expect(callMcpTool).not.toHaveBeenCalled();
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
    expect(callMcpTool).not.toHaveBeenCalled();
  });

  it('routes to the instance on the requested --port when several share the cwd', async () => {
    const onOtherPort = { ...record, instanceId: 'inst-2', pid: 2, port: 6007 };
    vi.mocked(readRegistry).mockResolvedValue([record, onOtherPort]);
    const result = await runAiTool('list-all-documentation', [], {
      cwd: '/projects/foo',
      port: '6007',
    });
    expect(callMcpTool).toHaveBeenCalledWith(onOtherPort, expect.anything(), undefined);
    expect(result.exitCode).toBe(0);
  });

  it('prints the port-mismatch repair markdown when no instance at the cwd is on the port', async () => {
    const result = await runAiTool('list-all-documentation', [], {
      cwd: '/projects/foo',
      port: '9999',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('not on port `9999`');
    expect(result.output).toContain('- port `6006`');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'port-mismatch' });
  });

  it('rejects an invalid --port without contacting the registry', async () => {
    const result = await runAiTool('list-all-documentation', [], {
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
    const result = await runAiTool('get-documentation', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(expected);
    expect(result.outcome).toEqual({ kind: 'intercept', reason });
  });

  it('prints a placeholder when the tool returns no content', async () => {
    vi.mocked(callMcpTool).mockResolvedValue({ content: [] });
    const result = await runAiTool('list-all-documentation', [], { cwd: '/projects/foo' });
    expect(result).toEqual({
      exitCode: 0,
      output: '(the command returned no content)',
      outcome: { kind: 'success' },
    });
  });

  it('surfaces a clean error when a ready record is missing its endpoint', async () => {
    vi.mocked(callMcpTool).mockRejectedValue(
      new Error('The Storybook instance at /projects/foo has no server endpoint registered')
    );
    vi.mocked(readRegistry).mockResolvedValue([{ ...record, mcp: { status: 'ready' } }]);
    const result = await runAiTool('list-all-documentation', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Failed to reach the Storybook server at (no endpoint)');
  });

  it('renders non-text content items as JSON blocks', async () => {
    vi.mocked(callMcpTool).mockResolvedValue({
      content: [
        { type: 'text', text: 'intro' },
        { type: 'resource_link', uri: 'http://x' },
      ],
    });
    const result = await runAiTool('get-documentation', [], { cwd: '/projects/foo' });
    expect(result.output).toContain('intro');
    expect(result.output).toContain('```json');
    expect(result.output).toContain('"resource_link"');
  });

  it('does not call live MCP for commands hidden by preset metadata', async () => {
    const result = await runAiTool('run-story-tests', [], { cwd: '/projects/foo' });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unknown command `run-story-tests`');
    expect(result.output).toContain('- `list-all-documentation`');
    expect(result.output).not.toContain('- `run-story-tests`');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'unknown-command' });
    expect(readRegistry).not.toHaveBeenCalled();
    expect(callMcpTool).not.toHaveBeenCalled();
  });

  it('lists the server tools when a metadata-visible runtime command is missing server-side', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      ...defaultRuntimeMetadata,
      tools: [...defaultRuntimeMetadata.tools, { name: 'no-such-tool', description: 'Stale tool' }],
    });
    vi.mocked(callMcpTool).mockRejectedValue(new McpJsonRpcError(-32601, 'unknown tool'));

    const result = await runAiTool('no-such-tool', [], { cwd: '/projects/foo' });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unknown command `no-such-tool`');
    expect(result.output).toContain('- `list-all-documentation`');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'unknown-command' });
  });

  it('lists the available tools when the server reports the unknown tool as an error result', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      ...defaultRuntimeMetadata,
      tools: [...defaultRuntimeMetadata.tools, { name: 'no-such-tool', description: 'Stale tool' }],
    });
    // addon-mcp (tmcp) reports unknown tools as an isError result, not a JSON-RPC error.
    vi.mocked(callMcpTool).mockResolvedValue({
      content: [{ type: 'text', text: 'Tool no-such-tool not found' }],
      isError: true,
    });
    const result = await runAiTool('no-such-tool', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unknown command `no-such-tool`');
    expect(result.output).toContain('- `list-all-documentation`');
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'unknown-command' });
  });

  it('keeps the original error result when the failing tool does exist', async () => {
    vi.mocked(callMcpTool).mockResolvedValue({
      content: [{ type: 'text', text: 'tests failed' }],
      isError: true,
    });
    const result = await runAiTool('list-all-documentation', [], { cwd: '/projects/foo' });
    expect(result).toEqual({
      exitCode: 1,
      output: 'tests failed',
      outcome: { kind: 'error', error: expect.objectContaining({ name: 'McpToolResultError' }) },
    });
    // Constant message keeps the telemetry error hash aggregatable; the tool's error text only
    // travels as `cause` (uploaded path-sanitized, and only with crash-reports consent).
    const error = (result.outcome as { error: Error }).error;
    expect(error.message).toBe('The Storybook AI command returned an error result');
    expect(error.cause).toBe('tests failed');
  });

  it('prints the original JSON-RPC error when the tool exists', async () => {
    const error = new McpJsonRpcError(-32602, 'invalid arguments');
    vi.mocked(callMcpTool).mockRejectedValue(error);
    const result = await runAiTool('list-all-documentation', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Storybook server error -32602: invalid arguments');
    expect(result.outcome).toEqual({ kind: 'error', error });
  });

  it('prints the original JSON-RPC error when the tool list cannot be fetched', async () => {
    const error = new McpJsonRpcError(-32601, 'unknown tool');
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      ...defaultRuntimeMetadata,
      tools: [...defaultRuntimeMetadata.tools, { name: 'no-such-tool', description: 'Stale tool' }],
    });
    vi.mocked(callMcpTool).mockRejectedValue(error);
    vi.mocked(listMcpTools).mockRejectedValue(new Error('boom'));
    const result = await runAiTool('no-such-tool', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Storybook server error -32601: unknown tool');
    expect(result.outcome).toEqual({ kind: 'error', error });
  });

  it('surfaces a friendly error when the MCP server is unreachable', async () => {
    const error = new Error('connection refused');
    vi.mocked(callMcpTool).mockRejectedValue(error);
    const result = await runAiTool('get-documentation', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Failed to reach the Storybook server at /mcp');
    expect(result.output).toContain('connection refused');
    expect(result.outcome).toEqual({ kind: 'error', error });
  });

  it('prepends a warning when multiple instances run at the same cwd', async () => {
    const sibling = { ...record, instanceId: 'inst-2', pid: 2, url: 'http://localhost:6007' };
    vi.mocked(readRegistry).mockResolvedValue([record, sibling]);
    const result = await runAiTool('list-all-documentation', [], { cwd: '/projects/foo' });
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
      const result = await runAiTool('list-all-documentation', [], { cwd: '/projects/foo' });

      expect(callMcpTool).toHaveBeenCalledWith(
        selectedPreview,
        { name: 'list-all-documentation', arguments: {} },
        undefined
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
          name: 'get-documentation',
          description: 'Get docs for a component.\n\nLong details that should not appear.',
        },
        { name: 'list-all-documentation' },
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
    expect(section).toContain('get-documentation');
    expect(section).toContain('[requires Storybook] Get docs for a component.');
    expect(section).toContain('get-storybook-story-instructions  [local]');
    expect(section).toContain('Get docs for a component.');
    expect(section).not.toContain('Long details');
    expect(section).toContain("Run 'storybook ai <command> --help'");
    expect(readRegistry).not.toHaveBeenCalled();
  });

  it('prints workflow instructions before the dynamic commands list', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      tools: [{ name: 'get-documentation', description: 'Get docs for a component.' }],
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
        '  get-documentation  [requires Storybook] Get docs for a component.',
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
      tools: [{ name: 'get-documentation', description: 'Get docs for a component.' }],
      instructions: '   ',
    });
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain('# Storybook commands');
    expect(section).toContain('get-documentation');
    expect(section).not.toContain('# Storybook workflow instructions');
  });

  it('ignores --port on the serverless help path', async () => {
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo', port: 'abc' });
    expect(section).toContain('Storybook help from the Storybook configuration');
    expect(section).toContain('list-all-documentation');
    expect(loadStorybookAiMetadata).toHaveBeenCalledWith({
      cwd: resolve('/projects/foo'),
      configDir: resolve('/projects/foo/.storybook'),
    });
  });

  it('loads the command section from a custom config dir', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      tools: [{ name: 'get-documentation', description: 'Get docs for a component.' }],
      instructions: 'Follow the story workflow.',
    });

    const section = await buildStorybookCommandsHelp({
      cwd: '/projects/foo',
      configDir: 'config/storybook',
    });

    expect(section).toContain('get-documentation');
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
          name: 'get-documentation',
          description: 'Get docs for a component.',
          inputSchema: {
            properties: { id: { type: 'string', description: 'Documentation id' } },
            required: ['id'],
          },
        },
      ],
    });

    const result = await runAiToolHelp('get-documentation', { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage: storybook ai get-documentation');
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
          name: 'display-review',
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

    const result = await runAiToolHelp('display-review', { cwd: '/projects/foo' });

    expect(result.exitCode).toBe(0);
    // Nested array-item fields self-document; the primitive `changedFiles` array
    // stays flat (no "each item:" expansion).
    expect(result.output).toMatchInlineSnapshot(`
      "Usage: storybook ai display-review [--key value ...]

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
          name: 'preview-stories',
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

    const result = await runAiToolHelp('preview-stories', { cwd: '/projects/foo' });

    expect(result.exitCode).toBe(0);
    expect(result.output).toMatchInlineSnapshot(`
      "Usage: storybook ai preview-stories [--key value ...]

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
              // `items: false` is valid JSON Schema but outside the node schema, so
              // validation fails and the help must degrade rather than throw or drop it.
              weird: { type: 'string', description: 'An odd one', items: false },
            },
            required: ['weird'],
          },
        },
      ],
    });

    const result = await runAiToolHelp('exotic-tool', { cwd: '/projects/foo' });

    expect(result.exitCode).toBe(0);
    // Degrades to the top-level type/description; no crash, no dropped argument.
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
      tools: [{ name: 'get-documentation', description: 'Get docs.' }],
    });
    const result = await runAiTool('get-documentation', ['--help'], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage: storybook ai get-documentation');
    expect(result.outcome).toEqual({ kind: 'help' });
    expect(callMcpTool).not.toHaveBeenCalled();
    expect(readRegistry).not.toHaveBeenCalled();
  });

  it('honors the config dir option on the help path after the tool name', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'get-documentation', description: 'Get docs.' }],
    });
    const result = await runAiTool('get-documentation', ['--help'], {
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
      tools: [{ name: 'get-documentation', description: 'Get docs.' }],
    });
    const result = await runAiTool('get-documentation', ['--port', 'not-a-port', '--help'], {
      cwd: '/projects/foo',
    });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage: storybook ai get-documentation');
    expect(readRegistry).not.toHaveBeenCalled();
  });

  it('lists the available tools for an unknown tool name', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'list-all-documentation', description: 'List docs' }],
    });
    const result = await runAiToolHelp('no-such-tool', { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unknown command `no-such-tool`');
    expect(result.output).toContain('- `list-all-documentation`');
  });

  it('prints metadata unavailable guidance when no preset metadata is exposed', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue(undefined);
    const result = await runAiToolHelp('get-documentation', { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Storybook command metadata is unavailable');
    expect(result.output).toContain('@storybook/addon-mcp');
    expect(result.outcome).toEqual({ kind: 'help' });
  });

  it('ignores an invalid --port on direct help lookup', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'get-documentation', description: 'Get docs.' }],
    });

    const result = await runAiToolHelp('get-documentation', {
      cwd: '/projects/foo',
      port: 'abc',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage: storybook ai get-documentation');
  });

  it('loads direct help from a custom config dir', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'get-documentation', description: 'Get docs.' }],
    });

    const result = await runAiToolHelp('get-documentation', {
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
    const result = await runAiToolHelp('get-documentation', { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Storybook command metadata is unavailable');
    expect(result.output).toContain('main config failed');
  });
});
