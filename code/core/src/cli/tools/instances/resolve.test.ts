import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockNodePath } from '../test-support/mock-node-path.ts';
import { selectInstances } from './resolve.ts';
import type { McpStatus, StorybookInstanceRecord } from './types.ts';

vi.mock('node:path', { spy: true });

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

describe('selectInstances', () => {
  it('returns no-instance with empty candidates when registry is empty', () => {
    const result = selectInstances([], { cwd: '/Users/x/projects/foo' });
    expect(result).toEqual({ kind: 'no-instance', records: [] });
  });

  it('returns no-instance with all records as candidates when nothing matches the project', () => {
    const a = record('/Users/x/projects/foo');
    const result = selectInstances([a], { cwd: '/Users/x/projects/bar' });
    expect(result).toEqual({ kind: 'no-instance', records: [a] });
  });

  it('matches a record by exact normalized cwd', () => {
    const r = record('/Users/x/projects/foo');
    const result = selectInstances([r], { cwd: '/Users/x/projects/foo' });
    expect(result).toEqual({ kind: 'match', matches: [r] });
  });

  it('normalizes trailing slashes and dot segments before matching', () => {
    const r = record('/Users/x/projects/foo');
    const result = selectInstances([r], { cwd: '/Users/x/projects/foo/./' });
    expect(result).toEqual({ kind: 'match', matches: [r] });
  });

  it('does NOT match a child path of a record cwd (exact only)', () => {
    const r = record('/Users/x/projects/foo');
    const result = selectInstances([r], { cwd: '/Users/x/projects/foo/src/Button.tsx' });
    expect(result).toEqual({ kind: 'no-instance', records: [r] });
  });

  it('does NOT match a sibling string prefix', () => {
    const r = record('/Users/x/projects/foo');
    const result = selectInstances([r], { cwd: '/Users/x/projects/foobar' });
    expect(result).toEqual({ kind: 'no-instance', records: [r] });
  });

  it('matches a record by configDir when the cwds differ (monorepo root dev, leaf CLI)', () => {
    const r = record('/repo', 'ready', { configDir: '/repo/packages/ui/.storybook' });
    const result = selectInstances([r], {
      cwd: '/repo/packages/ui',
      configDir: '/repo/packages/ui/.storybook',
    });
    expect(result).toEqual({ kind: 'match', matches: [r] });
  });

  it('matches a record by cwd when the DEFAULTED configDir differs', () => {
    const r = record('/repo/packages/ui', 'ready', {
      configDir: '/repo/packages/ui/.storybook',
    });
    const result = selectInstances([r], {
      cwd: '/repo/packages/ui',
      configDir: '/repo/.storybook',
    });
    expect(result).toEqual({ kind: 'match', matches: [r] });
  });

  it('does NOT fall back to cwd matching when an EXPLICIT configDir differs', () => {
    const r = record('/repo', 'ready', { configDir: '/repo/.storybook' });
    const result = selectInstances([r], {
      cwd: '/repo',
      configDir: '/repo/packages/ui/.storybook',
      configDirExplicit: true,
    });
    expect(result).toEqual({ kind: 'no-instance', records: [r] });
  });

  it('selects by an EXPLICIT configDir among same-cwd instances serving different configs', () => {
    const packageA = record('/repo', 'ready', {
      configDir: '/repo/packages/a/.storybook',
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const newerPackageB = record('/repo', 'ready', {
      configDir: '/repo/packages/b/.storybook',
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = selectInstances([packageA, newerPackageB], {
      cwd: '/repo',
      configDir: '/repo/packages/a/.storybook',
      configDirExplicit: true,
    });
    expect(result).toEqual({ kind: 'match', matches: [packageA] });
  });

  it('cannot select records without a recorded configDir via an EXPLICIT configDir', () => {
    const legacy = record('/repo/packages/ui');
    const result = selectInstances([legacy], {
      cwd: '/repo/packages/ui',
      configDir: '/repo/packages/ui/.storybook',
      configDirExplicit: true,
    });
    expect(result).toEqual({ kind: 'no-instance', records: [legacy] });
  });

  it('normalizes trailing slashes and dot segments in configDirs before matching', () => {
    const r = record('/repo', 'ready', { configDir: '/repo/packages/ui/.storybook' });
    const result = selectInstances([r], {
      cwd: '/elsewhere',
      configDir: '/repo/packages/ui/./.storybook/',
    });
    expect(result).toEqual({ kind: 'match', matches: [r] });
  });

  it('does NOT match by configDir prefix (exact only)', () => {
    const r = record('/repo', 'ready', { configDir: '/repo/packages/ui/.storybook' });
    const result = selectInstances([r], {
      cwd: '/elsewhere',
      configDir: '/repo/packages/ui/.storybook/subdir',
    });
    expect(result).toEqual({ kind: 'no-instance', records: [r] });
  });

  it('does NOT match records without a recorded configDir by configDir (older Storybooks)', () => {
    const r = record('/repo');
    const result = selectInstances([r], {
      cwd: '/repo/packages/ui',
      configDir: '/repo/packages/ui/.storybook',
    });
    expect(result).toEqual({ kind: 'no-instance', records: [r] });
  });

  it('does NOT match a recorded configDir when the target has no configDir', () => {
    const r = record('/repo', 'ready', { configDir: '/repo/packages/ui/.storybook' });
    const result = selectInstances([r], { cwd: '/repo/packages/ui' });
    expect(result).toEqual({ kind: 'no-instance', records: [r] });
  });

  it('buckets cwd-matched and configDir-matched records together', () => {
    const byCwd = record('/repo/packages/ui', 'ready', {
      pid: 100,
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const byConfigDir = record('/repo', 'ready', {
      configDir: '/repo/packages/ui/.storybook',
      pid: 200,
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = selectInstances([byCwd, byConfigDir], {
      cwd: '/repo/packages/ui',
      configDir: '/repo/packages/ui/.storybook',
    });
    expect(result).toEqual({ kind: 'match', matches: [byConfigDir, byCwd] });
  });

  it('orders matches most recently started first, regardless of MCP status', () => {
    const olderReady = record('/Users/x/projects/foo', 'ready', {
      pid: 100,
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const newerNotInstalled = record('/Users/x/projects/foo', 'not-installed', {
      pid: 200,
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = selectInstances([olderReady, newerNotInstalled], {
      cwd: '/Users/x/projects/foo',
    });
    expect(result).toEqual({ kind: 'match', matches: [newerNotInstalled, olderReady] });
  });

  it('tie-breaks on lowest pid when 2+ records share the cwd and none carry a startedAt', () => {
    const a = record('/Users/x/projects/foo', 'ready', { pid: 200 });
    const b = record('/Users/x/projects/foo', 'ready', { pid: 100 });
    const result = selectInstances([a, b], { cwd: '/Users/x/projects/foo' });
    expect(result).toEqual({ kind: 'match', matches: [b, a] });
  });

  it('treats a record without startedAt as older than one with a startedAt', () => {
    const noStamp = record('/Users/x/projects/foo', 'ready', { pid: 100 });
    const stamped = record('/Users/x/projects/foo', 'ready', {
      pid: 200,
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = selectInstances([noStamp, stamped], { cwd: '/Users/x/projects/foo' });
    expect(result).toEqual({ kind: 'match', matches: [stamped, noStamp] });
  });

  it('prefers the invoking agent bucket over recency across buckets', () => {
    const olderPreview = record('/Users/x/projects/foo', 'ready', {
      agent: 'claude-preview',
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const newerCodex = record('/Users/x/projects/foo', 'ready', {
      agent: 'codex',
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = selectInstances([olderPreview, newerCodex], {
      cwd: '/Users/x/projects/foo',
      agent: 'claude',
    });
    expect(result).toEqual({ kind: 'match', matches: [olderPreview] });
  });

  it('prefers Claude preview records over generic Claude records for Claude CLI invocations', () => {
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
    const result = selectInstances([genericClaude, claudePreview, newerCodex], {
      cwd: '/Users/x/projects/foo',
      agent: 'claude',
    });
    expect(result).toEqual({ kind: 'match', matches: [claudePreview] });
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
    const result = selectInstances([genericClaude, newerCodex], {
      cwd: '/Users/x/projects/foo',
      agent: 'claude',
    });
    expect(result).toEqual({ kind: 'match', matches: [genericClaude] });
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
    const result = selectInstances([codex, newerCursor], {
      cwd: '/Users/x/projects/foo',
      agent: 'codex',
    });
    expect(result).toEqual({ kind: 'match', matches: [codex] });
  });

  it('orders the selected agent bucket most recently started first', () => {
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
    const result = selectInstances([olderPreview, newerPreview, newestCodex], {
      cwd: '/Users/x/projects/foo',
      agent: 'claude',
    });
    expect(result).toEqual({ kind: 'match', matches: [newerPreview, olderPreview] });
  });

  it('falls back to latest-started behavior when no record matches the current agent', () => {
    const older = record('/Users/x/projects/foo', 'ready', {
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const newer = record('/Users/x/projects/foo', 'ready', {
      agent: 'cursor',
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = selectInstances([older, newer], {
      cwd: '/Users/x/projects/foo',
      agent: 'codex',
    });
    expect(result).toEqual({ kind: 'match', matches: [newer, older] });
  });

  it('falls back to latest-started behavior when no current agent is detected', () => {
    const olderPreview = record('/Users/x/projects/foo', 'ready', {
      agent: 'claude-preview',
      startedAt: '2026-06-09T10:00:00.000Z',
    });
    const newerCodex = record('/Users/x/projects/foo', 'ready', {
      agent: 'codex',
      startedAt: '2026-06-09T11:00:00.000Z',
    });
    const result = selectInstances([olderPreview, newerCodex], { cwd: '/Users/x/projects/foo' });
    expect(result).toEqual({ kind: 'match', matches: [newerCodex, olderPreview] });
  });

  it('ignores port when it is not supplied (routes by cwd alone)', () => {
    const a = record('/Users/x/projects/foo', 'ready', { pid: 100, port: 6006 });
    const b = record('/Users/x/projects/foo', 'ready', { pid: 200, port: 6007 });
    const result = selectInstances([a, b], { cwd: '/Users/x/projects/foo' });
    expect(result).toEqual({ kind: 'match', matches: [a, b] });
  });

  it('restricts the matches to the supplied port', () => {
    const a = record('/Users/x/projects/foo', 'ready', { pid: 100, port: 6006 });
    const b = record('/Users/x/projects/foo', 'ready', { pid: 200, port: 6007 });
    const result = selectInstances([a, b], { cwd: '/Users/x/projects/foo', port: 6006 });
    expect(result).toEqual({ kind: 'match', matches: [a] });
  });

  it('selects the instance on the supplied port even when the invoking agent bucket holds another', () => {
    const a = record('/Users/x/projects/foo', 'ready', {
      agent: 'claude-preview',
      pid: 100,
      port: 6006,
    });
    const b = record('/Users/x/projects/foo', 'ready', { agent: 'codex', pid: 200, port: 6007 });
    const result = selectInstances([a, b], {
      cwd: '/Users/x/projects/foo',
      port: 6007,
      agent: 'claude',
    });
    expect(result).toEqual({ kind: 'match', matches: [b] });
  });

  it('selects across projects by port alone, most recently started first', () => {
    const foo = record('/Users/x/projects/foo', 'ready', {
      port: 6006,
      startedAt: '2026-08-27T10:00:00.000Z',
    });
    const bar = record('/Users/x/projects/bar', 'ready', {
      port: 6006,
      startedAt: '2026-08-27T11:00:00.000Z',
    });
    const result = selectInstances([foo, bar], { cwd: '/Users/x/projects/other', port: 6006 });
    expect(result).toEqual({ kind: 'match', matches: [bar, foo] });
  });

  it('returns port-mismatch with the running instances when no instance is on the port', () => {
    const a = record('/Users/x/projects/foo', 'ready', { pid: 100, port: 6006 });
    const b = record('/Users/x/projects/foo', 'ready', { pid: 200, port: 6007 });
    const result = selectInstances([a, b], { cwd: '/Users/x/projects/foo', port: 9999 });
    expect(result).toEqual({ kind: 'port-mismatch', port: 9999, candidates: [a, b] });
  });

  it('returns port-mismatch when the configDir matches but no instance is on the port', () => {
    const r = record('/repo', 'ready', {
      configDir: '/repo/packages/ui/.storybook',
      port: 6006,
    });
    const result = selectInstances([r], {
      cwd: '/repo/packages/ui',
      configDir: '/repo/packages/ui/.storybook',
      port: 9999,
    });
    expect(result).toEqual({ kind: 'port-mismatch', port: 9999, candidates: [r] });
  });

  it('returns port-mismatch listing instances of other projects when nothing is on the port', () => {
    const a = record('/Users/x/projects/foo', 'ready', { port: 6006 });
    const result = selectInstances([a], { cwd: '/Users/x/projects/bar', port: 9999 });
    expect(result).toEqual({ kind: 'port-mismatch', port: 9999, candidates: [a] });
  });

  it('returns no-instance when a port is supplied but nothing is running at all', () => {
    const result = selectInstances([], { cwd: '/Users/x/projects/bar', port: 6006 });
    expect(result).toEqual({ kind: 'no-instance', records: [] });
  });

  it('restricts port matching to the explicit --config-dir when both are supplied', () => {
    const ui = record('/repo', 'ready', { configDir: '/repo/packages/ui/.storybook', port: 6006 });
    const docs = record('/repo', 'ready', {
      configDir: '/repo/packages/docs/.storybook',
      port: 6007,
    });
    const result = selectInstances([ui, docs], {
      cwd: '/repo',
      configDir: '/repo/packages/ui/.storybook',
      configDirExplicit: true,
      port: 6007,
    });
    expect(result).toEqual({ kind: 'port-mismatch', port: 6007, candidates: [ui] });
  });
});

describe('Windows instance matching', () => {
  beforeEach(() => {
    mockNodePath('win32');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('matches a recorded C:/ cwd against lowercase drive-letter and separator variants', () => {
    const r = record('C:/dev/temp/qa-10.6/cases/react-vite');
    for (const cwd of [
      'C:\\dev\\temp\\qa-10.6\\cases\\react-vite',
      'C:/dev/temp/qa-10.6/cases/react-vite',
      'c:\\dev\\temp\\qa-10.6\\cases\\react-vite',
      'c:/dev/temp/qa-10.6/cases/react-vite',
    ]) {
      expect(selectInstances([r], { cwd })).toEqual({ kind: 'match', matches: [r] });
    }
  });

  it('matches configDir across Windows drive-letter case when cwds differ', () => {
    const r = record('C:/repo', 'ready', { configDir: 'C:/repo/packages/ui/.storybook' });
    const result = selectInstances([r], {
      cwd: 'c:/elsewhere',
      configDir: 'c:\\repo\\packages\\ui\\.storybook',
    });
    expect(result).toEqual({ kind: 'match', matches: [r] });
  });

  it('does not match a different Windows path', () => {
    const r = record('C:/proj');
    const result = selectInstances([r], { cwd: 'C:/other' });
    expect(result).toEqual({ kind: 'no-instance', records: [r] });
  });
});

describe('POSIX instance matching', () => {
  beforeEach(() => {
    mockNodePath('posix');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps POSIX cwd compares byte-exact', () => {
    const r = record('/Users/x/foo');
    expect(selectInstances([r], { cwd: '/Users/x/foo' })).toEqual({ kind: 'match', matches: [r] });
    expect(selectInstances([r], { cwd: '/Users/x/Foo' })).toEqual({
      kind: 'no-instance',
      records: [r],
    });
  });
});
