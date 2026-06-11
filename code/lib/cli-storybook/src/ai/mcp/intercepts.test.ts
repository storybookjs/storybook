import { describe, expect, it } from 'vitest';

import { getInterceptMarkdown } from './intercepts.ts';
import type { StorybookInstanceRecord } from './types.ts';

const record = (cwd: string, url: string): StorybookInstanceRecord => ({
  schemaVersion: 1,
  instanceId: 'i-1',
  pid: 1,
  cwd,
  url,
  port: 6006,
  mcp: { status: 'ready', endpoint: '/mcp' },
});

describe('getInterceptMarkdown', () => {
  it('no-instance without candidates tells the agent to start storybook dev', () => {
    const markdown = getInterceptMarkdown('no-instance');
    expect(markdown).toContain('Storybook is not running at this cwd');
    expect(markdown).toContain('storybook dev');
  });

  it('no-instance with candidates lists the running cwds', () => {
    const markdown = getInterceptMarkdown('no-instance', {
      records: [record('/projects/foo', 'http://localhost:6006')],
    });
    expect(markdown).toContain('Running Storybooks:');
    expect(markdown).toContain('- `/projects/foo` (http://localhost:6006)');
    expect(markdown).toContain('--cwd');
  });

  it('port-mismatch lists the ports running at the cwd', () => {
    const markdown = getInterceptMarkdown('port-mismatch', {
      port: 9999,
      records: [record('/projects/foo', 'http://localhost:6006')],
    });
    expect(markdown).toContain('not on port `9999`');
    expect(markdown).toContain('- port `6006`');
    expect(markdown).toContain('omit `--port`');
  });

  it('addon-missing instructs installing the MCP addon', () => {
    const markdown = getInterceptMarkdown('addon-missing');
    expect(markdown).toContain('`@storybook/addon-mcp` addon is missing');
    expect(markdown).toContain('npx storybook add @storybook/addon-mcp');
  });

  it('mcp-starting asks to wait and retry', () => {
    expect(getInterceptMarkdown('mcp-starting')).toContain('still starting up');
  });

  it('mcp-error points at the Storybook terminal output', () => {
    expect(getInterceptMarkdown('mcp-error')).toContain('Inspect the Storybook terminal output');
  });
});
