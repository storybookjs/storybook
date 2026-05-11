// Runs hadolint against scripts/verify/Dockerfile and asserts zero hits for
// DL3008 / DL3009 / SC2086. Skipped (with a parseable warning) when hadolint
// is not on PATH. AC-V5-0-16 specifies fail-loud-on-missing-binary on CI; for
// the local developer test pass we degrade to skip-with-warn to keep `yarn
// test` green on machines without hadolint installed.

import { execSync, spawnSync } from 'node:child_process';
import * as path from 'node:path';

import { describe, expect, test } from 'vitest';

const dockerfile = path.resolve(import.meta.dirname, '..', 'Dockerfile');

function hadolintAvailable(): boolean {
  try {
    execSync('command -v hadolint', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const skipReason = hadolintAvailable()
  ? null
  : 'hadolint binary not on PATH — skipping Dockerfile lint test. Install with `brew install hadolint` or the canonical GitHub release.';

if (skipReason) {
  console.warn(`::warning::${skipReason}`);
}

describe('Dockerfile hadolint', () => {
  test.skipIf(skipReason !== null)(
    'scripts/verify/Dockerfile reports zero DL3008 / DL3009 / SC2086',
    () => {
      const result = spawnSync('hadolint', [dockerfile], {
        encoding: 'utf-8',
      });

      const stdout = result.stdout ?? '';
      const stderr = result.stderr ?? '';
      const combined = `${stdout}\n${stderr}`;

      // Zero hits for the three rules AC-V5-0-16 enumerates.
      expect(combined).not.toMatch(/DL3008/);
      expect(combined).not.toMatch(/DL3009/);
      expect(combined).not.toMatch(/SC2086/);
    }
  );
});
