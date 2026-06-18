import { beforeEach, describe, expect, it, vi } from 'vitest';

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
      cwd: '/projects/foo',
      configDir: undefined,
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

  it.each([
    ['--config-dir', ['--config-dir', 'config/storybook']],
    ['-c', ['-c', 'config/storybook']],
  ])('loads known local tools from a custom config dir with %s', async (_label, tokens) => {
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

    const result = await runAiTool('get-storybook-story-instructions', tokens, {
      cwd: '/projects/foo',
    });

    expect(result.output).toBe('custom config instructions');
    expect(loadStorybookAiMetadata).toHaveBeenCalledWith({
      cwd: '/projects/foo',
      configDir: 'config/storybook',
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
    expect(result.output).toContain('No Storybook is running at this cwd');
    expect(result.output).toContain('/projects/foo');
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
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'unknown-command' });
    expect(readRegistry).not.toHaveBeenCalled();
    expect(callMcpTool).not.toHaveBeenCalled();
  });

  it('routes to the instance on the requested --port when several share the cwd', async () => {
    const onOtherPort = { ...record, instanceId: 'inst-2', pid: 2, port: 6007 };
    vi.mocked(readRegistry).mockResolvedValue([record, onOtherPort]);
    const result = await runAiTool('list-all-documentation', ['--port', '6007'], {
      cwd: '/projects/foo',
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
    const result = await runAiTool('list-all-documentation', ['--port', 'abc'], {
      cwd: '/projects/foo',
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
    expect(error.message).toBe('The Storybook MCP server returned an error result');
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
    expect(result.output).toContain('Multiple Storybook instances');
    expect(result.output).toContain('pid `1`');
    expect(result.output).toContain('pid `2`');
    expect(result.output).toContain('(used)');
    expect(result.output).toContain('upstream result');
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
      'Storybook help from the Storybook configuration at /projects/foo/.storybook:'
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
        'Storybook help from the Storybook configuration at /projects/foo/.storybook:',
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

  it('degrades to a note when commands are exposed without workflow instructions', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      tools: [{ name: 'get-documentation', description: 'Get docs for a component.' }],
      instructions: '   ',
    });
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain('Storybook commands: (unavailable');
    expect(section).toContain('exposed commands but no workflow instructions');
  });

  it('ignores --port on the serverless help path', async () => {
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo', port: 'abc' });
    expect(section).toContain('Storybook help from the Storybook configuration');
    expect(section).toContain('list-all-documentation');
    expect(loadStorybookAiMetadata).toHaveBeenCalledWith({
      cwd: '/projects/foo',
      configDir: undefined,
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
      cwd: '/projects/foo',
      configDir: 'config/storybook',
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

  it('honors --config-dir tokens on the help path after the tool name', async () => {
    vi.mocked(loadStorybookAiMetadata).mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [{ name: 'get-documentation', description: 'Get docs.' }],
    });
    const result = await runAiTool(
      'get-documentation',
      ['--config-dir', 'config/storybook', '--help'],
      { cwd: '/projects/foo' }
    );
    expect(result.exitCode).toBe(0);
    expect(loadStorybookAiMetadata).toHaveBeenCalledWith({
      cwd: '/projects/foo',
      configDir: 'config/storybook',
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
      cwd: '/projects/foo',
      configDir: 'config/storybook',
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
