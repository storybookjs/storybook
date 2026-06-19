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

  it('tie-breaks on lowest pid when 2+ records share the cwd and none carry a startedAt', () => {
    const a = record('/Users/x/projects/foo', 'ready', { pid: 200 });
    const b = record('/Users/x/projects/foo', 'ready', { pid: 100 });
    const result = resolveInstance([a, b], '/Users/x/projects/foo');
    expect(result.kind).toBe('instance');
    if (result.kind === 'instance') {
      expect(result.record).toBe(b);
      expect(result.matches).toEqual([b, a]);
    }
  });

  it('picks the most recently started ready instance when 2+ records share the cwd', () => {
    const older = record('/Users/x/projects/foo', 'ready', {
      pid: 100,
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const newer = record('/Users/x/projects/foo', 'ready', {
      pid: 200,
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = resolveInstance([older, newer], '/Users/x/projects/foo');
    expect(result.kind).toBe('instance');
    if (result.kind === 'instance') {
      expect(result.record).toBe(newer);
      expect(result.matches).toEqual([newer, older]);
    }
  });

  it('treats a record without startedAt as older than one with a startedAt', () => {
    const noStamp = record('/Users/x/projects/foo', 'ready', { pid: 100 });
    const stamped = record('/Users/x/projects/foo', 'ready', {
      pid: 200,
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = resolveInstance([noStamp, stamped], '/Users/x/projects/foo');
    expect(result.kind).toBe('instance');
    if (result.kind === 'instance') {
      expect(result.record).toBe(stamped);
    }
  });

  it('prefers a ready record over a more recently started non-ready one', () => {
    const ready = record('/Users/x/projects/foo', 'ready', {
      pid: 100,
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const newerStarting = record('/Users/x/projects/foo', 'starting', {
      pid: 200,
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = resolveInstance([ready, newerStarting], '/Users/x/projects/foo');
    expect(result.kind).toBe('instance');
    if (result.kind === 'instance') {
      expect(result.record).toBe(ready);
    }
  });

  it('dispatches the most recently started instance status when none are ready', () => {
    const olderError = record('/Users/x/projects/foo', 'error', {
      pid: 100,
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const newerStarting = record('/Users/x/projects/foo', 'starting', {
      pid: 200,
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = resolveInstance([olderError, newerStarting], '/Users/x/projects/foo');
    expect(result.kind).toBe('intercept');
    if (result.kind === 'intercept') {
      expect(result.reason).toBe('mcp-starting');
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

  it('selects the instance matching BOTH cwd and port when a port is supplied', () => {
    const a = record('/Users/x/projects/foo', 'ready', {
      agent: 'claude-preview',
      pid: 100,
      port: 6006,
    });
    const b = record('/Users/x/projects/foo', 'ready', { agent: 'codex', pid: 200, port: 6007 });
    const result = resolveInstance([a, b], '/Users/x/projects/foo', 6007, 'claude');
    expect(result.kind).toBe('instance');
    if (result.kind === 'instance') {
      expect(result.record).toBe(b);
      expect(result.matches).toEqual([b]);
    }
  });

  it('prefers Claude preview records for Claude CLI invocations', () => {
    const genericClaude = record('/Users/x/projects/foo', 'ready', {
      agent: 'claude',
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const claudePreview = record('/Users/x/projects/foo', 'ready', {
      agent: 'claude-preview',
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const newerCodex = record('/Users/x/projects/foo', 'ready', {
      agent: 'codex',
      startedAt: '2026-06-09T12:00:00.000Z',
    });
    const result = resolveInstance(
      [genericClaude, claudePreview, newerCodex],
      '/Users/x/projects/foo',
      undefined,
      'claude'
    );

    expect(result.kind).toBe('instance');
    if (result.kind === 'instance') {
      expect(result.record).toBe(claudePreview);
      expect(result.matches).toEqual([claudePreview]);
    }
  });

  it('falls back to generic Claude records when no Claude preview record matches', () => {
    const genericClaude = record('/Users/x/projects/foo', 'ready', {
      agent: 'claude',
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const newerCodex = record('/Users/x/projects/foo', 'ready', {
      agent: 'codex',
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = resolveInstance(
      [genericClaude, newerCodex],
      '/Users/x/projects/foo',
      undefined,
      'claude'
    );

    expect(result.kind).toBe('instance');
    if (result.kind === 'instance') {
      expect(result.record).toBe(genericClaude);
      expect(result.matches).toEqual([genericClaude]);
    }
  });

  it('stays in the preferred agent bucket even when another bucket is ready', () => {
    const startingPreview = record('/Users/x/projects/foo', 'starting', {
      agent: 'claude-preview',
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const readyCodex = record('/Users/x/projects/foo', 'ready', {
      agent: 'codex',
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const result = resolveInstance(
      [startingPreview, readyCodex],
      '/Users/x/projects/foo',
      undefined,
      'claude'
    );

    expect(result.kind).toBe('intercept');
    if (result.kind === 'intercept') {
      expect(result.reason).toBe('mcp-starting');
      expect(result.matches).toEqual([startingPreview]);
    }
  });

  it('prefers records matching the current non-Claude agent', () => {
    const codex = record('/Users/x/projects/foo', 'ready', {
      agent: 'codex',
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const newerCursor = record('/Users/x/projects/foo', 'ready', {
      agent: 'cursor',
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = resolveInstance(
      [codex, newerCursor],
      '/Users/x/projects/foo',
      undefined,
      'codex'
    );

    expect(result.kind).toBe('instance');
    if (result.kind === 'instance') {
      expect(result.record).toBe(codex);
      expect(result.matches).toEqual([codex]);
    }
  });

  it('chooses the latest-started ready instance inside the selected agent bucket', () => {
    const olderPreview = record('/Users/x/projects/foo', 'ready', {
      agent: 'claude-preview',
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const newerPreview = record('/Users/x/projects/foo', 'ready', {
      agent: 'claude-preview',
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const newestCodex = record('/Users/x/projects/foo', 'ready', {
      agent: 'codex',
      startedAt: '2026-06-09T12:00:00.000Z',
    });
    const result = resolveInstance(
      [olderPreview, newerPreview, newestCodex],
      '/Users/x/projects/foo',
      undefined,
      'claude'
    );

    expect(result.kind).toBe('instance');
    if (result.kind === 'instance') {
      expect(result.record).toBe(newerPreview);
      expect(result.matches).toEqual([newerPreview, olderPreview]);
    }
  });

  it('falls back to latest-started behavior when no record matches the current agent', () => {
    const older = record('/Users/x/projects/foo', 'ready', {
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const newer = record('/Users/x/projects/foo', 'ready', {
      agent: 'cursor',
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = resolveInstance([older, newer], '/Users/x/projects/foo', undefined, 'codex');

    expect(result.kind).toBe('instance');
    if (result.kind === 'instance') {
      expect(result.record).toBe(newer);
      expect(result.matches).toEqual([newer, older]);
    }
  });

  it('ignores port when it is not supplied (routes by cwd alone)', () => {
    const a = record('/Users/x/projects/foo', 'ready', { pid: 100, port: 6006 });
    const b = record('/Users/x/projects/foo', 'ready', { pid: 200, port: 6007 });
    const result = resolveInstance([a, b], '/Users/x/projects/foo');
    expect(result.kind).toBe('instance');
    if (result.kind === 'instance') {
      expect(result.record).toBe(a);
      expect(result.matches).toEqual([a, b]);
    }
  });

  it('returns port-mismatch with the cwd instances as candidates when cwd matches but no instance is on the port', () => {
    const a = record('/Users/x/projects/foo', 'ready', { pid: 100, port: 6006 });
    const b = record('/Users/x/projects/foo', 'ready', { pid: 200, port: 6007 });
    const result = resolveInstance([a, b], '/Users/x/projects/foo', 9999);
    expect(result.kind).toBe('intercept');
    if (result.kind === 'intercept') {
      expect(result.reason).toBe('port-mismatch');
      expect(result.records).toEqual([a, b]);
      expect(result.matches).toEqual([]);
    }
  });

  it('returns no-instance (not port-mismatch) when the cwd itself does not match', () => {
    const a = record('/Users/x/projects/foo', 'ready', { port: 6006 });
    const result = resolveInstance([a], '/Users/x/projects/bar', 6006);
    expect(result.kind).toBe('intercept');
    if (result.kind === 'intercept') {
      expect(result.reason).toBe('no-instance');
    }
  });
});
