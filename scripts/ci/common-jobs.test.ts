import { afterEach, describe, expect, it } from 'vitest';

import { build_linux } from './common-jobs.ts';
import { setLockfileChanged } from './utils/runtime.ts';

const stepNames = () => {
  const implementation = build_linux.implementation('normal');
  const steps = 'steps' in implementation ? implementation.steps : [];
  return steps.map((step) => (step as { run?: { name: string } }).run?.name ?? step);
};

describe('build_linux', () => {
  afterEach(() => {
    setLockfileChanged(false);
  });

  it('checks for dedupe when the pull request changes pnpm-lock.yaml', () => {
    setLockfileChanged(true);

    expect(stepNames()).toContain('Check for dedupe');
  });

  // `pnpm dedupe` also moves dependencies to newer versions once those pass the release-age gate,
  // so on an unchanged lockfile the check would fail without any change in the repository.
  it('skips the dedupe check when the lockfile is unchanged', () => {
    setLockfileChanged(false);

    expect(stepNames()).not.toContain('Check for dedupe');
  });
});
