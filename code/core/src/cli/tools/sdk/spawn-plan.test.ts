import { describe, expect, it } from 'vitest';

import type { StorybookInstanceRecord } from '../instances/types.ts';
import { planAttachHost } from './spawn-plan.ts';

const record: Pick<StorybookInstanceRecord, 'cwd' | 'storybookVersion'> = {
  cwd: '/repo',
  storybookVersion: '10.2.0',
};

const matching = {
  processCwd: '/repo',
  callerVersion: '10.2.0',
  record,
  resolvedProjectVersion: '10.2.0',
};

describe('planAttachHost', () => {
  it('stays in-process when cwd and version already match the instance', () => {
    expect(
      planAttachHost({
        ...matching,
        autoSpawn: true,
        isChildHost: false,
      })
    ).toEqual({ action: 'in-process' });
  });

  it('stays in-process even when auto-spawn is declined or this process is already a child host', () => {
    expect(
      planAttachHost({
        ...matching,
        autoSpawn: false,
        isChildHost: true,
        resolvedProjectVersion: undefined,
      })
    ).toEqual({ action: 'in-process' });
  });

  it('stays in-process when the process already matches, even if the on-disk package does not', () => {
    expect(
      planAttachHost({
        ...matching,
        autoSpawn: true,
        isChildHost: false,
        resolvedProjectVersion: '10.3.0',
      })
    ).toEqual({ action: 'in-process' });
  });

  it('throws a mismatch when cwd differs and auto-spawn is declined', () => {
    expect(
      planAttachHost({
        ...matching,
        processCwd: '/elsewhere',
        autoSpawn: false,
        isChildHost: false,
      })
    ).toEqual({
      action: 'throw-mismatch',
      fidelity: {
        ok: false,
        kind: 'cwd',
        processCwd: expect.stringMatching(/elsewhere$/),
        instanceCwd: expect.stringMatching(/repo$/),
      },
    });
  });

  it('throws a mismatch when the caller version differs and auto-spawn is declined', () => {
    expect(
      planAttachHost({
        ...matching,
        callerVersion: '10.1.0',
        autoSpawn: false,
        isChildHost: false,
      })
    ).toEqual({
      action: 'throw-mismatch',
      fidelity: {
        ok: false,
        kind: 'version',
        callerVersion: '10.1.0',
        instanceVersion: '10.2.0',
      },
    });
  });

  it('throws a mismatch when a child host itself is not the instance twin', () => {
    expect(
      planAttachHost({
        ...matching,
        processCwd: '/elsewhere',
        autoSpawn: true,
        isChildHost: true,
      })
    ).toMatchObject({ action: 'throw-mismatch' });
    expect(
      planAttachHost({
        ...matching,
        callerVersion: '10.1.0',
        autoSpawn: true,
        isChildHost: true,
      })
    ).toMatchObject({ action: 'throw-mismatch' });
  });

  it('spawns from the instance cwd when the caller cwd differs and the project package matches the instance', () => {
    expect(
      planAttachHost({
        ...matching,
        processCwd: '/elsewhere',
        autoSpawn: true,
        isChildHost: false,
      })
    ).toEqual({ action: 'spawn', cwd: '/repo' });
  });

  it('spawns when the caller version differs and the project package matches the instance', () => {
    expect(
      planAttachHost({
        ...matching,
        callerVersion: '10.3.0',
        autoSpawn: true,
        isChildHost: false,
      })
    ).toEqual({ action: 'spawn', cwd: '/repo' });
  });

  it('spawns when both cwd and caller version differ and the project package still matches the instance', () => {
    expect(
      planAttachHost({
        ...matching,
        processCwd: '/elsewhere',
        callerVersion: '10.3.0',
        autoSpawn: true,
        isChildHost: false,
      })
    ).toEqual({ action: 'spawn', cwd: '/repo' });
  });

  it('refuses to spawn when a version mismatch cannot be fixed because the project package also differs', () => {
    expect(
      planAttachHost({
        ...matching,
        callerVersion: '10.3.0',
        autoSpawn: true,
        isChildHost: false,
        resolvedProjectVersion: '10.4.0',
      })
    ).toEqual({
      action: 'throw-restart',
      instanceVersion: '10.2.0',
      resolvedProjectVersion: '10.4.0',
    });
  });

  it('refuses to spawn when cwd differs and the package under the instance cwd is not the running version', () => {
    expect(
      planAttachHost({
        ...matching,
        processCwd: '/elsewhere',
        autoSpawn: true,
        isChildHost: false,
        resolvedProjectVersion: '10.4.0',
      })
    ).toEqual({
      action: 'throw-restart',
      instanceVersion: '10.2.0',
      resolvedProjectVersion: '10.4.0',
    });
  });

  it('uses unknown when the instance record has no storybookVersion and the on-disk package cannot match it', () => {
    expect(
      planAttachHost({
        processCwd: '/repo',
        callerVersion: '10.2.0',
        record: { cwd: '/repo', storybookVersion: undefined },
        autoSpawn: true,
        isChildHost: false,
        resolvedProjectVersion: '10.2.0',
      })
    ).toEqual({
      action: 'throw-restart',
      instanceVersion: 'unknown',
      resolvedProjectVersion: '10.2.0',
    });
  });

  it('fails to spawn when the project has no resolvable storybook package', () => {
    expect(
      planAttachHost({
        ...matching,
        processCwd: '/elsewhere',
        autoSpawn: true,
        isChildHost: false,
        resolvedProjectVersion: undefined,
      })
    ).toEqual({ action: 'throw-spawn-failed' });
    expect(
      planAttachHost({
        ...matching,
        callerVersion: '10.3.0',
        autoSpawn: true,
        isChildHost: false,
        resolvedProjectVersion: undefined,
      })
    ).toEqual({ action: 'throw-spawn-failed' });
  });

  it('prefers a mismatch throw over spawn failure when auto-spawn is declined and the package cannot be resolved', () => {
    expect(
      planAttachHost({
        ...matching,
        processCwd: '/elsewhere',
        autoSpawn: false,
        isChildHost: false,
        resolvedProjectVersion: undefined,
      })
    ).toMatchObject({ action: 'throw-mismatch' });
  });

  it('prefers a mismatch throw over restart when a child host sees a stale on-disk package', () => {
    expect(
      planAttachHost({
        ...matching,
        callerVersion: '10.3.0',
        autoSpawn: true,
        isChildHost: true,
        resolvedProjectVersion: '10.4.0',
      })
    ).toMatchObject({ action: 'throw-mismatch' });
  });
});
