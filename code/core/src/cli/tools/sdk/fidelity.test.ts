import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { StorybookInstanceRecord } from '../instances/types.ts';
import { checkFidelity } from './fidelity.ts';

const storybookFile = fileURLToPath(import.meta.url);

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

  it('accepts a storybook binary cwd when this process resolves the same package', () => {
    expect(
      checkFidelity({ ...record, cwd: storybookFile }, { cwd: process.cwd(), version: '10.2.0' })
    ).toEqual({ ok: true });
  });

  it('rejects a storybook binary cwd that cannot resolve the same package', () => {
    expect(
      checkFidelity(
        { ...record, cwd: '/no-such-storybook-bin' },
        { cwd: process.cwd(), version: '10.2.0' }
      )
    ).toEqual({
      ok: false,
      kind: 'cwd',
      processCwd: expect.any(String),
      instanceCwd: expect.stringMatching(/no-such-storybook-bin$/),
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
});
