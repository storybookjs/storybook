import { beforeEach, describe, expect, it, vi } from 'vitest';

import { McpJsonRpcError, callMcpTool, listMcpTools } from './client.ts';
import { readRegistry } from './registry.ts';
import { runAiListTools, runAiTool } from './run-tool.ts';
import type { StorybookInstanceRecord } from './types.ts';
import { checkStorybookVersion } from './version-check.ts';

vi.mock('./registry.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./registry.ts')>()),
  readRegistry: vi.fn(),
}));

// Preserve the McpJsonRpcError class identity so `instanceof` checks keep working.
vi.mock('./client.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client.ts')>()),
  callMcpTool: vi.fn(),
  listMcpTools: vi.fn(),
}));

vi.mock('./version-check.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./version-check.ts')>()),
  checkStorybookVersion: vi.fn(),
}));

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
  vi.mocked(checkStorybookVersion).mockReset().mockReturnValue({ status: 'ok' });
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
    vi.mocked(checkStorybookVersion).mockReturnValue({ status: 'not-installed' });
    vi.mocked(readRegistry).mockResolvedValue([]);
    const result = await runAiTool('get-documentation', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('storybook-init');
  });

  it('still forwards to a running instance when the version check reports not-installed (monorepo false negative)', async () => {
    vi.mocked(checkStorybookVersion).mockReturnValue({ status: 'not-installed' });
    const result = await runAiTool('list-all-documentation', [], { cwd: '/projects/foo' });
    expect(result).toEqual({ exitCode: 0, output: 'upstream result' });
  });

  it('prints the storybook-too-old repair markdown before reading the registry', async () => {
    vi.mocked(checkStorybookVersion).mockReturnValue({ status: 'too-old', version: '9.0.5' });
    const result = await runAiTool('get-documentation', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('`9.0.5`');
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
    expect(result.output).toContain('Unknown tool `no-such-tool`');
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
    expect(result.output).toContain('Unknown tool `no-such-tool`');
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
    expect(result.output).toContain('Storybook MCP error -32602: invalid arguments');
  });

  it('prints the original JSON-RPC error when the tool list cannot be fetched', async () => {
    vi.mocked(callMcpTool).mockRejectedValue(new McpJsonRpcError(-32601, 'unknown tool'));
    vi.mocked(listMcpTools).mockRejectedValue(new Error('boom'));
    const result = await runAiTool('no-such-tool', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Storybook MCP error -32601: unknown tool');
  });

  it('surfaces a friendly error when the MCP server is unreachable', async () => {
    vi.mocked(callMcpTool).mockRejectedValue(new Error('connection refused'));
    const result = await runAiTool('get-documentation', [], { cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Failed to reach Storybook MCP at /mcp');
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

describe('runAiListTools', () => {
  it('prints the tool list with descriptions and arguments', async () => {
    vi.mocked(listMcpTools).mockResolvedValue([
      {
        name: 'get-documentation',
        description: 'Get docs for a component.',
        inputSchema: {
          properties: { id: { type: 'string', description: 'Documentation id' } },
          required: ['id'],
        },
      },
      { name: 'list-all-documentation' },
    ]);

    const result = await runAiListTools({ cwd: '/projects/foo' });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain(
      '# MCP tools exposed by the Storybook at http://localhost:6006'
    );
    expect(result.output).toContain('## get-documentation');
    expect(result.output).toContain('Get docs for a component.');
    expect(result.output).toContain('- `--id` (string, required): Documentation id');
    expect(result.output).toContain('## list-all-documentation');
  });

  it('reports an empty tool list', async () => {
    vi.mocked(listMcpTools).mockResolvedValue([]);
    const result = await runAiListTools({ cwd: '/projects/foo' });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('exposes no MCP tools');
  });

  it('prints repair markdown and exits non-zero on intercepts', async () => {
    vi.mocked(readRegistry).mockResolvedValue([]);
    const result = await runAiListTools({ cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Storybook is not running at this cwd');
  });

  it('surfaces a friendly error when the MCP server is unreachable', async () => {
    vi.mocked(listMcpTools).mockRejectedValue(new Error('connection refused'));
    const result = await runAiListTools({ cwd: '/projects/foo' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Failed to reach Storybook MCP at /mcp');
  });
});
