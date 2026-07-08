import { describe, expect, it } from 'vitest';

import { getInterceptMarkdown } from './intercepts.ts';
import type { StorybookInstanceRecord } from './types.ts';

const record = (
  cwd: string,
  url: string,
  overrides: Partial<StorybookInstanceRecord> = {}
): StorybookInstanceRecord => ({
  schemaVersion: 1,
  instanceId: 'i-1',
  pid: 1,
  cwd,
  url,
  port: 6006,
  mcp: { status: 'ready', endpoint: '/mcp' },
  ...overrides,
});

describe('getInterceptMarkdown', () => {
  it('no-instance without candidates tells the agent to start storybook dev', () => {
    const markdown = getInterceptMarkdown('no-instance');
    expect(markdown).toContain('Storybook is not running at this cwd');
    expect(markdown).toContain('storybook dev');
  });

  it('no-instance with candidates lists the running instances and a copyable --cwd retry', () => {
    const markdown = getInterceptMarkdown('no-instance', {
      records: [record('/projects/foo', 'http://localhost:6006')],
    });
    expect(markdown).toContain('Running Storybooks:');
    expect(markdown).toContain('- cwd `/projects/foo` (http://localhost:6006)');
    expect(markdown).toContain('- `storybook ai --cwd /projects/foo <command> [args...]`');
    expect(markdown).toContain('BEFORE the command name');
    expect(markdown).not.toContain('storybook ai --config-dir');
  });

  it('no-instance with candidates includes the recorded config dir and a --config-dir retry', () => {
    const markdown = getInterceptMarkdown('no-instance', {
      records: [
        record('/repo', 'http://localhost:6006', {
          configDir: '/repo/packages/ui/.storybook',
        }),
      ],
    });
    expect(markdown).toContain(
      '- cwd `/repo`, config dir `/repo/packages/ui/.storybook` (http://localhost:6006)'
    );
    expect(markdown).toContain(
      '- `storybook ai --config-dir /repo/packages/ui/.storybook <command> [args...]`'
    );
    // A bare `--cwd /repo` retry would fail metadata loading when the config is not at
    // /repo/.storybook, so it must not be offered for records with a configDir.
    expect(markdown).not.toContain('storybook ai --cwd');
  });

  it('no-instance quotes paths containing whitespace in retry examples', () => {
    const markdown = getInterceptMarkdown('no-instance', {
      records: [
        record('/Users/John Smith/proj', 'http://localhost:6006'),
        record('/repo', 'http://localhost:6007', {
          instanceId: 'i-2',
          pid: 2,
          configDir: '/repo/my packages/ui/.storybook',
        }),
      ],
    });
    expect(markdown).toContain(
      '- `storybook ai --cwd "/Users/John Smith/proj" <command> [args...]`'
    );
    expect(markdown).toContain(
      '- `storybook ai --config-dir "/repo/my packages/ui/.storybook" <command> [args...]`'
    );
  });

  it('no-instance deduplicates retry examples across records sharing a cwd', () => {
    const markdown = getInterceptMarkdown('no-instance', {
      records: [
        record('/projects/foo', 'http://localhost:6006'),
        record('/projects/foo', 'http://localhost:6007', { instanceId: 'i-2', pid: 2 }),
      ],
    });
    const occurrences = markdown.split('`storybook ai --cwd /projects/foo').length - 1;
    expect(occurrences).toBe(1);
  });

  it('port-mismatch lists the ports running for the project', () => {
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
