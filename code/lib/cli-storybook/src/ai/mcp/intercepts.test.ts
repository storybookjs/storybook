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

  it('storybook-too-old names the detected and minimum versions and the upgrade skill', () => {
    const markdown = getInterceptMarkdown('storybook-too-old', { version: '9.0.5' });
    expect(markdown).toContain('`9.0.5`');
    expect(markdown).toContain('`10.5.0`');
    expect(markdown).toContain('storybook-upgrade');
    expect(markdown).toContain('npx storybook add @storybook/addon-mcp');
  });

  it('storybook-not-installed points at the init skill and the addon install', () => {
    const markdown = getInterceptMarkdown('storybook-not-installed');
    expect(markdown).toContain('storybook-init');
    expect(markdown).toContain('npx storybook add @storybook/addon-mcp');
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
