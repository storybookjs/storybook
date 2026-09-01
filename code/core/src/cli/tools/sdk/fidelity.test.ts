import { posix, win32 } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorybookInstanceRecord } from '../instances/types.ts';
import { mockNodePath } from '../test-support/mock-node-path.ts';
import { checkFidelity } from './fidelity.ts';

vi.mock('node:path', { spy: true });

const record: StorybookInstanceRecord = {
  schemaVersion: 1,
  instanceId: 'abc',
  pid: 123,
  cwd: '/repo',
  configDir: '/repo/.storybook',
  url: 'http://localhost:6006',
  port: 6006,
  token: 'secret',
  storybookVersion: '10.2.0',
  mcp: { status: 'ready' },
};

describe('checkFidelity', () => {
  it('accepts the same cwd and Storybook version as the instance', () => {
    expect(checkFidelity(record, { cwd: '/repo', version: '10.2.0' })).toEqual({ ok: true });
  });

  it('rejects any cwd mismatch, even when versions match', () => {
    expect(checkFidelity(record, { cwd: '/elsewhere', version: '10.2.0' })).toEqual({
      ok: false,
      kind: 'cwd',
      processCwd: expect.stringMatching(/elsewhere$/),
      instanceCwd: expect.stringMatching(/repo$/),
    });
  });

  it('rejects a version mismatch, including a record with no storybookVersion', () => {
    expect(checkFidelity(record, { cwd: '/repo', version: '10.1.0' })).toEqual({
      ok: false,
      kind: 'version',
      callerVersion: '10.1.0',
      instanceVersion: '10.2.0',
    });
    expect(
      checkFidelity({ ...record, storybookVersion: undefined }, { cwd: '/repo', version: '10.2.0' })
    ).toEqual({
      ok: false,
      kind: 'version',
      callerVersion: '10.2.0',
      instanceVersion: 'unknown',
    });
  });

  describe('on Windows', () => {
    beforeEach(() => {
      mockNodePath('win32');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('accepts a Windows cwd that differs only by drive-letter case or separators', () => {
      const windowsRecord = { ...record, cwd: 'C:/repo' };
      expect(checkFidelity(windowsRecord, { cwd: 'c:\\repo', version: '10.2.0' })).toEqual({
        ok: true,
      });
      expect(checkFidelity(windowsRecord, { cwd: 'C:\\repo', version: '10.2.0' })).toEqual({
        ok: true,
      });
      expect(checkFidelity(windowsRecord, { cwd: 'c:/repo', version: '10.2.0' })).toEqual({
        ok: true,
      });
    });

    it('accepts Windows cwds that differ only in letter case', () => {
      expect(
        checkFidelity(
          { ...record, cwd: 'C:/Users/Jeppe/Proj' },
          { cwd: 'c:/users/jeppe/proj', version: '10.2.0' }
        )
      ).toEqual({ ok: true });
    });

    it('rejects a different Windows cwd even when versions match', () => {
      expect(
        checkFidelity({ ...record, cwd: 'C:/repo' }, { cwd: 'C:/elsewhere', version: '10.2.0' })
      ).toEqual({
        ok: false,
        kind: 'cwd',
        processCwd: win32.resolve('C:/elsewhere'),
        instanceCwd: win32.resolve('C:/repo'),
      });
    });
  });

  describe('on POSIX', () => {
    beforeEach(() => {
      mockNodePath('posix');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('keeps POSIX cwd compares byte-exact', () => {
      expect(checkFidelity(record, { cwd: '/repo', version: '10.2.0' })).toEqual({ ok: true });
      expect(checkFidelity(record, { cwd: '/Repo', version: '10.2.0' })).toEqual({
        ok: false,
        kind: 'cwd',
        processCwd: posix.resolve('/Repo'),
        instanceCwd: posix.resolve('/repo'),
      });
    });
  });
});
