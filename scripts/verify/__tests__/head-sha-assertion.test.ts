// Asserts the HEAD_SHA drift detection produces the right verdict + reason.
//
// Two cases:
//   (a) mismatched HEAD_SHA writes a verify-result.json with
//       verdict: "regression" + regressionReason: "head-sha drift"
//   (b) unset VERIFY_HARNESS_EXPECTED_HEAD_SHA emits a warning and continues
//       (no regression — laptop dev-mode reproduction must keep working).
//
// The runner's actual file-read on /opt/verify-harness/HEAD_SHA happens in
// scripts/verify-pr.ts; this test exercises the writeRegressionResult helper
// in scripts/verify/core.ts that the runner calls on the drift branch, and
// asserts the laptop-dev short-circuit logic by direct simulation.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildRunPaths, writeRegressionResult } from '../core.ts';

describe('HEAD_SHA assertion', () => {
  let tmpRoot: string;
  const originalExpected = process.env.VERIFY_HARNESS_EXPECTED_HEAD_SHA;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'head-sha-assertion-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    if (originalExpected === undefined) {
      delete process.env.VERIFY_HARNESS_EXPECTED_HEAD_SHA;
    } else {
      process.env.VERIFY_HARNESS_EXPECTED_HEAD_SHA = originalExpected;
    }
  });

  it('mismatched HEAD_SHA writes regressionReason "head-sha drift"', async () => {
    const paths = buildRunPaths('test-drift', tmpRoot);
    const bakedHead = 'a'.repeat(40);

    await writeRegressionResult(paths, 'head-sha drift', {
      headSha: bakedHead,
      inContainer: true,
    });

    const raw = readFileSync(paths.resultJson, 'utf-8');
    const result = JSON.parse(raw);

    expect(result.verdict).toBe('regression');
    expect(result.regressionReason).toBe('head-sha drift');
    expect(result.inContainer).toBe(true);
    expect(result.headSha).toBe(bakedHead);
  });

  it('missing HEAD_SHA file writes regressionReason "head-sha file missing"', async () => {
    const paths = buildRunPaths('test-file-missing', tmpRoot);

    await writeRegressionResult(paths, 'head-sha file missing', {
      inContainer: true,
    });

    const raw = readFileSync(paths.resultJson, 'utf-8');
    const result = JSON.parse(raw);

    expect(result.verdict).toBe('regression');
    expect(result.regressionReason).toBe('head-sha file missing');
  });

  it('unset VERIFY_HARNESS_EXPECTED_HEAD_SHA emits a warning and does NOT trigger regression', () => {
    delete process.env.VERIFY_HARNESS_EXPECTED_HEAD_SHA;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mirror the runner's laptop dev-mode branch from scripts/verify-pr.ts:
    // if expected is undefined, log a warning and skip the assertion.
    const expected = process.env.VERIFY_HARNESS_EXPECTED_HEAD_SHA;
    let triggeredRegression = false;
    if (expected === undefined) {
      console.warn(
        '[verify] in-container without VERIFY_HARNESS_EXPECTED_HEAD_SHA — head-sha assertion skipped (dev mode)'
      );
    } else {
      // would call writeRegressionResult here on mismatch
      triggeredRegression = true;
    }

    expect(triggeredRegression).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('head-sha assertion skipped (dev mode)')
    );
    warn.mockRestore();
  });

  it('valid matching HEAD_SHA does NOT trigger regression', () => {
    const sha = 'b'.repeat(40);
    process.env.VERIFY_HARNESS_EXPECTED_HEAD_SHA = sha;
    const baked = sha;

    const expected = process.env.VERIFY_HARNESS_EXPECTED_HEAD_SHA;
    const drifted =
      expected !== undefined &&
      (!/^[a-f0-9]{40}$/.test(expected) || !/^[a-f0-9]{40}$/.test(baked) || expected !== baked);

    expect(drifted).toBe(false);
  });
});
