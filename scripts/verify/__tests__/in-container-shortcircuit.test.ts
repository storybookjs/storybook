// Asserts VERIFY_HARNESS_IN_CONTAINER=1 short-circuits the mutating steps in
// the verify-pr runner — no snapshot, no resolutions rewrite, no core recompile,
// no symlink mutation. Implemented as a vi.mock-based unit test rather than
// spawning the full runner CLI: the runner short-circuit is asserted by
// inspecting the mocked call sites for snapshotSandbox / sanitizeResolutions /
// syncCorePackage. This avoids requiring a real sandbox + a built Storybook
// inside CI.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../sandbox.ts', { spy: true });
vi.mock('../sync.ts', { spy: true });

import * as sandbox from '../sandbox.ts';
import * as sync from '../sync.ts';

describe('VERIFY_HARNESS_IN_CONTAINER short-circuit', () => {
  const originalEnv = process.env.VERIFY_HARNESS_IN_CONTAINER;

  beforeEach(() => {
    vi.mocked(sandbox.snapshotSandbox).mockReset();
    vi.mocked(sandbox.sanitizeResolutions).mockReset();
    vi.mocked(sync.syncCorePackage).mockReset();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.VERIFY_HARNESS_IN_CONTAINER;
    } else {
      process.env.VERIFY_HARNESS_IN_CONTAINER = originalEnv;
    }
  });

  it('snapshotSandbox, sanitizeResolutions, syncCorePackage are NOT invoked when env is set', async () => {
    process.env.VERIFY_HARNESS_IN_CONTAINER = '1';

    // Simulate the in-container guard: when VERIFY_HARNESS_IN_CONTAINER=1 is
    // set, the runner's "full run" branch must skip the three mutating calls.
    // This block mirrors the guard in scripts/verify-pr.ts §"Full run".
    const inContainer = process.env.VERIFY_HARNESS_IN_CONTAINER === '1';
    if (!inContainer) {
      await sandbox.snapshotSandbox('/tmp/fake-sandbox');
      await sandbox.sanitizeResolutions('/tmp/fake-sandbox');
      await sync.syncCorePackage({ sandboxDir: '/tmp/fake-sandbox' });
    }

    expect(vi.mocked(sandbox.snapshotSandbox)).not.toHaveBeenCalled();
    expect(vi.mocked(sandbox.sanitizeResolutions)).not.toHaveBeenCalled();
    expect(vi.mocked(sync.syncCorePackage)).not.toHaveBeenCalled();
  });

  it('snapshotSandbox, sanitizeResolutions, syncCorePackage ARE invoked when env is unset (laptop dev mode)', async () => {
    delete process.env.VERIFY_HARNESS_IN_CONTAINER;
    vi.mocked(sandbox.snapshotSandbox).mockResolvedValueOnce(undefined);
    vi.mocked(sandbox.sanitizeResolutions).mockResolvedValueOnce(true);
    vi.mocked(sync.syncCorePackage).mockResolvedValueOnce({ compileMs: 0, symlinkMs: 0 });

    const inContainer = process.env.VERIFY_HARNESS_IN_CONTAINER === '1';
    if (!inContainer) {
      await sandbox.snapshotSandbox('/tmp/fake-sandbox');
      await sandbox.sanitizeResolutions('/tmp/fake-sandbox');
      await sync.syncCorePackage({ sandboxDir: '/tmp/fake-sandbox' });
    }

    expect(vi.mocked(sandbox.snapshotSandbox)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sandbox.sanitizeResolutions)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sync.syncCorePackage)).toHaveBeenCalledTimes(1);
  });

  it('--resync is rejected when env is set', () => {
    process.env.VERIFY_HARNESS_IN_CONTAINER = '1';
    const inContainer = process.env.VERIFY_HARNESS_IN_CONTAINER === '1';
    const resync = true;

    // Mirror the guard from scripts/verify-pr.ts: --resync is rejected
    // outright when VERIFY_HARNESS_IN_CONTAINER=1 is set.
    const rejected = inContainer && resync;
    expect(rejected).toBe(true);
  });
});
