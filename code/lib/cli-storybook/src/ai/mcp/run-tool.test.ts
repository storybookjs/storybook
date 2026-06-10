import { beforeEach, describe, expect, it, vi } from 'vitest';

import { McpJsonRpcError, callMcpTool, listMcpTools } from './client.ts';
import { isStorybookInstalled } from './installed-check.ts';
import { readRegistry } from './registry.ts';
import { buildStorybookCommandsHelp, runAiTool, runAiToolHelp } from './run-tool.ts';
import type { StorybookInstanceRecord } from './types.ts';

vi.mock('./registry.ts', { spy: true });
vi.mock('./client.ts', { spy: true });
vi.mock('./installed-check.ts', { spy: true });

const record: StorybookInstanceRecord = {
  schemaVersion: 1,
  instanceId: 'inst-1',
  pid: 1,
  cwd: '/projects/foo',
  url: 'http://localhost:6006',
  port: 6006,
  mcp: { status: 'ready', endpoint: '/mcp' },
};

beforeEach(() => {
  vi.mocked(readRegistry).mockReset().mockResolvedValue([record]);
  vi.mocked(isStorybookInstalled).mockReset().mockReturnValue(true);
  vi.mocked(callMcpTool)
    .mockReset()
    .mockResolvedValue({ content: [{ type: 'text', text: 'upstream result' }] });
  vi.mocked(listMcpTools)
    .mockReset()
    .mockResolvedValue([{ name: 'list-all-documentation', description: 'List docs' }]);
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
    expect(result).toEqual({ exitCode: 0, output: 'upstream result' });
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
    expect(readRegistry).not.toHaveBeenCalled();
  });

  it('prints the no-instance repair markdown and exits non-zero when nothing runs at the cwd', async () => {
    const result = await runAiTool('get-documentation', [], { cwd: '/projects/other' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('No Storybook is running at this cwd');
    expect(result.output).toContain('/projects/foo');
  });

  it('prints the storybook-not-installed repair markdown when nothing runs and storybook is unresolvable', async () => {
    vi.mocked(isStorybookInstalled).mockReturnValue(false);
    vi.mocked(readRegistry).mockResolvedValue([]);
    const result = await runAiTool('get-documentation', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('storybook-init');
  });

  it('still forwards to a running instance even when storybook is not resolvable from the cwd (monorepo false negative)', async () => {
    vi.mocked(isStorybookInstalled).mockReturnValue(false);
    const result = await runAiTool('list-all-documentation', [], { cwd: '/projects/foo' });
    expect(result).toEqual({ exitCode: 0, output: 'upstream result' });
    expect(isStorybookInstalled).not.toHaveBeenCalled();
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
    ['starting', 'still starting up'],
    ['not-installed', '`@storybook/addon-mcp` addon is missing'],
    ['error', 'Inspect the Storybook terminal output'],
  ] as const)('prints the repair markdown for mcp.status=%s', async (status, expected) => {
    vi.mocked(readRegistry).mockResolvedValue([{ ...record, mcp: { status } }]);
    const result = await runAiTool('get-documentation', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(expected);
  });

  it('prints a placeholder when the tool returns no content', async () => {
    vi.mocked(callMcpTool).mockResolvedValue({ content: [] });
    const result = await runAiTool('list-all-documentation', [], { cwd: '/projects/foo' });
    expect(result).toEqual({ exitCode: 0, output: '(the command returned no content)' });
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

  it('lists the available tools when the call fails because the tool is unknown', async () => {
    vi.mocked(callMcpTool).mockRejectedValue(new McpJsonRpcError(-32601, 'unknown tool'));
    const result = await runAiTool('no-such-tool', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unknown command `no-such-tool`');
    expect(result.output).toContain('- `list-all-documentation`');
  });

  it('lists the available tools when the server reports the unknown tool as an error result', async () => {
    // addon-mcp (tmcp) reports unknown tools as an isError result, not a JSON-RPC error.
    vi.mocked(callMcpTool).mockResolvedValue({
      content: [{ type: 'text', text: 'Tool no-such-tool not found' }],
      isError: true,
    });
    const result = await runAiTool('no-such-tool', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unknown command `no-such-tool`');
    expect(result.output).toContain('- `list-all-documentation`');
  });

  it('keeps the original error result when the failing tool does exist', async () => {
    vi.mocked(callMcpTool).mockResolvedValue({
      content: [{ type: 'text', text: 'tests failed' }],
      isError: true,
    });
    const result = await runAiTool('list-all-documentation', [], { cwd: '/projects/foo' });
    expect(result).toEqual({ exitCode: 1, output: 'tests failed' });
  });

  it('prints the original JSON-RPC error when the tool exists', async () => {
    vi.mocked(callMcpTool).mockRejectedValue(new McpJsonRpcError(-32602, 'invalid arguments'));
    const result = await runAiTool('list-all-documentation', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Storybook server error -32602: invalid arguments');
  });

  it('prints the original JSON-RPC error when the tool list cannot be fetched', async () => {
    vi.mocked(callMcpTool).mockRejectedValue(new McpJsonRpcError(-32601, 'unknown tool'));
    vi.mocked(listMcpTools).mockRejectedValue(new Error('boom'));
    const result = await runAiTool('no-such-tool', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Storybook server error -32601: unknown tool');
  });

  it('surfaces a friendly error when the MCP server is unreachable', async () => {
    vi.mocked(callMcpTool).mockRejectedValue(new Error('connection refused'));
    const result = await runAiTool('get-documentation', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Failed to reach the Storybook server at /mcp');
    expect(result.output).toContain('connection refused');
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
    vi.mocked(listMcpTools).mockResolvedValue([
      {
        name: 'get-documentation',
        description: 'Get docs for a component.\n\nLong details that should not appear.',
      },
      { name: 'list-all-documentation' },
    ]);

    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain(
      'Storybook commands (from the Storybook running at http://localhost:6006):'
    );
    expect(section).toContain('get-documentation');
    expect(section).toContain('Get docs for a component.');
    expect(section).not.toContain('Long details');
    expect(section).toContain("Run 'storybook ai <command> --help'");
  });

  it('degrades to a note when no Storybook is running (help must not fail)', async () => {
    vi.mocked(readRegistry).mockResolvedValue([]);
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain('Storybook commands: (unavailable');
    expect(section).toContain('storybook dev');
  });

  it('lists the sibling ports when several instances run at the cwd', async () => {
    const older = { ...record, instanceId: 'inst-2', pid: 2, port: 6007 };
    const newest = { ...record, startedAt: '2026-06-10T12:00:00.000Z' };
    vi.mocked(readRegistry).mockResolvedValue([newest, older]);
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain('2 instances are running at this cwd');
    expect(section).toContain('port 6006');
    expect(section).toContain('other ports: 6007');
    expect(section).toContain('`--port`');
  });

  it('names the port mismatch instead of claiming nothing is running', async () => {
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo', port: '9999' });
    expect(section).toContain('Storybook commands: (unavailable');
    expect(section).toContain('no instance on port `9999`');
    expect(section).toContain('running ports: 6006');
    expect(section).not.toContain('no running Storybook detected');
  });

  it('says the Storybook is starting up instead of claiming nothing is running', async () => {
    vi.mocked(readRegistry).mockResolvedValue([{ ...record, mcp: { status: 'starting' } }]);
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain('still starting up');
  });

  it('points at the missing addon instead of claiming nothing is running', async () => {
    vi.mocked(readRegistry).mockResolvedValue([{ ...record, mcp: { status: 'not-installed' } }]);
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain('install `@storybook/addon-mcp`');
  });

  it('shows the Storybook version reported by the running instance', async () => {
    vi.mocked(readRegistry).mockResolvedValue([{ ...record, storybookVersion: '10.5.0' }]);
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain(
      'Storybook commands (from the Storybook running at http://localhost:6006, Storybook 10.5.0):'
    );
  });

  it('degrades to a note when the MCP server is unreachable', async () => {
    vi.mocked(listMcpTools).mockRejectedValue(new Error('connection refused'));
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain('Storybook commands: (unavailable');
    expect(section).toContain('could not be reached');
  });

  it('degrades to a note when no tools are exposed', async () => {
    vi.mocked(listMcpTools).mockResolvedValue([]);
    const section = await buildStorybookCommandsHelp({ cwd: '/projects/foo' });
    expect(section).toContain('provides no commands');
  });
});

describe('runAiToolHelp', () => {
  it('prints the description and arguments of a single tool', async () => {
    vi.mocked(listMcpTools).mockResolvedValue([
      {
        name: 'get-documentation',
        description: 'Get docs for a component.',
        inputSchema: {
          properties: { id: { type: 'string', description: 'Documentation id' } },
          required: ['id'],
        },
      },
    ]);

    const result = await runAiToolHelp('get-documentation', { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage: storybook ai get-documentation');
    expect(result.output).toContain('Get docs for a component.');
    expect(result.output).toContain('- `--id` (string, required): Documentation id');
  });

  it('is reachable through runAiTool via a --help token after the tool name', async () => {
    vi.mocked(listMcpTools).mockResolvedValue([
      { name: 'get-documentation', description: 'Get docs.' },
    ]);
    const result = await runAiTool('get-documentation', ['--help'], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage: storybook ai get-documentation');
    expect(callMcpTool).not.toHaveBeenCalled();
  });

  it('honors a --port token given after the command name on the help path', async () => {
    const result = await runAiTool('get-documentation', ['--port', '9999', '--help'], {
      cwd: '/projects/foo',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('not on port `9999`');
  });

  it('lists the available tools for an unknown tool name', async () => {
    const result = await runAiToolHelp('no-such-tool', { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unknown command `no-such-tool`');
    expect(result.output).toContain('- `list-all-documentation`');
  });

  it('prints repair markdown and exits non-zero on intercepts', async () => {
    vi.mocked(readRegistry).mockResolvedValue([]);
    const result = await runAiToolHelp('get-documentation', { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Storybook is not running at this cwd');
  });

  it('rejects an invalid --port', async () => {
    const result = await runAiToolHelp('get-documentation', {
      cwd: '/projects/foo',
      port: 'abc',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('`--port` must be a port number');
  });

  it('surfaces a friendly error when the MCP server is unreachable', async () => {
    vi.mocked(listMcpTools).mockRejectedValue(new Error('connection refused'));
    const result = await runAiToolHelp('get-documentation', { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Failed to reach the Storybook server at /mcp');
  });
});
