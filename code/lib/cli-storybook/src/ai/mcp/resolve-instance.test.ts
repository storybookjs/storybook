import { describe, expect, it } from 'vitest';

import { resolveInstance } from './resolve-instance.ts';
import type { McpStatus, StorybookInstanceRecord } from './types.ts';

let nextInstance = 0;

function record(
  cwd: string,
  status: McpStatus = 'ready',
  overrides: Partial<StorybookInstanceRecord> = {}
): StorybookInstanceRecord {
  nextInstance += 1;
  return {
    schemaVersion: 1,
    instanceId: `inst-${nextInstance}`,
    pid: 1000 + nextInstance,
    cwd,
    url: `http://localhost:${6000 + nextInstance}`,
    port: 6000 + nextInstance,
    mcp: {
      status,
      endpoint:
        status === 'ready' || status === 'error'
          ? `http://localhost:${6000 + nextInstance}/mcp`
          : undefined,
    },
    ...overrides,
  };
}

describe('resolveInstance', () => {
  it('returns no-instance with empty candidates when registry is empty', () => {
    const result = resolveInstance([], '/Users/x/projects/foo');
    expect(result).toEqual({ kind: 'intercept', reason: 'no-instance', records: [], matches: [] });
  });

  it('returns no-instance with candidates when no record cwd matches', () => {
    const a = record('/Users/x/projects/foo');
    const b = record('/Users/x/projects/bar');
    const result = resolveInstance([a, b], '/Users/x/projects/baz');
    expect(result.kind).toBe('intercept');
    if (result.kind === 'intercept') {
      expect(result.reason).toBe('no-instance');
      expect(result.records).toEqual([a, b]);
    }
  });

  it('matches a record by exact normalized cwd', () => {
    const r = record('/Users/x/projects/foo');
    const result = resolveInstance([r], '/Users/x/projects/foo');
    expect(result).toEqual({ kind: 'instance', record: r, matches: [r] });
  });

  it('normalizes trailing slashes and dot segments before matching', () => {
    const r = record('/Users/x/projects/foo');
    const result = resolveInstance([r], '/Users/x/projects/foo/./');
    expect(result).toEqual({ kind: 'instance', record: r, matches: [r] });
  });

  it('does NOT match a child path of a record cwd (exact only)', () => {
    const r = record('/Users/x/projects/foo');
    const result = resolveInstance([r], '/Users/x/projects/foo/src/Button.tsx');
    expect(result.kind).toBe('intercept');
    if (result.kind === 'intercept') {
      expect(result.reason).toBe('no-instance');
    }
  });

  it('does NOT match a sibling string prefix', () => {
    const r = record('/Users/x/projects/foo');
    const result = resolveInstance([r], '/Users/x/projects/foobar');
    expect(result.kind).toBe('intercept');
    if (result.kind === 'intercept') {
      expect(result.reason).toBe('no-instance');
    }
  });

  it('returns the lowest-pid ready instance plus all matches when 2+ records share the same exact cwd', () => {
    const a = record('/Users/x/projects/foo', 'ready', { pid: 200 });
    const b = record('/Users/x/projects/foo', 'ready', { pid: 100 });
    const result = resolveInstance([a, b], '/Users/x/projects/foo');
    expect(result.kind).toBe('instance');
    if (result.kind === 'instance') {
      expect(result.record).toBe(b);
      expect(result.matches).toEqual([b, a]);
    }
  });

  it('prefers a ready record over non-ready ones when multiple records share the cwd', () => {
    const starting = record('/Users/x/projects/foo', 'starting', { pid: 100 });
    const ready = record('/Users/x/projects/foo', 'ready', { pid: 200 });
    const result = resolveInstance([starting, ready], '/Users/x/projects/foo');
    expect(result.kind).toBe('instance');
    if (result.kind === 'instance') {
      expect(result.record).toBe(ready);
      expect(result.matches).toEqual([starting, ready]);
    }
  });

  it('falls back to dispatching the lowest-pid status when no record at the cwd is ready', () => {
    const a = record('/Users/x/projects/foo', 'starting', { pid: 200 });
    const b = record('/Users/x/projects/foo', 'error', { pid: 100 });
    const result = resolveInstance([a, b], '/Users/x/projects/foo');
    expect(result).toEqual({ kind: 'intercept', reason: 'mcp-error', matches: [b, a] });
  });

  it('dispatches mcp.status=starting as mcp-starting intercept', () => {
    const r = record('/p', 'starting');
    const result = resolveInstance([r], '/p');
    expect(result).toEqual({ kind: 'intercept', reason: 'mcp-starting', matches: [r] });
  });

  it('dispatches mcp.status=not-installed as addon-missing intercept', () => {
    const r = record('/p', 'not-installed');
    const result = resolveInstance([r], '/p');
    expect(result).toEqual({ kind: 'intercept', reason: 'addon-missing', matches: [r] });
  });

  it('dispatches mcp.status=error as mcp-error intercept', () => {
    const r = record('/p', 'error');
    const result = resolveInstance([r], '/p');
    expect(result).toEqual({ kind: 'intercept', reason: 'mcp-error', matches: [r] });
  });
});
