// Asserts STORYBOOK_SANDBOX_ROOT env var is honoured by resolveSandboxDir().
// The env override lets sandbox-target recipes point the harness at a sandbox
// tree located outside the default `../storybook-sandboxes/` path.

import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveSandboxDir } from '../sandbox.ts';

describe('resolveSandboxDir honours STORYBOOK_SANDBOX_ROOT', () => {
  let tmpRoot: string;
  const originalEnv = process.env.STORYBOOK_SANDBOX_ROOT;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'sandbox-root-env-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    if (originalEnv === undefined) {
      delete process.env.STORYBOOK_SANDBOX_ROOT;
    } else {
      process.env.STORYBOOK_SANDBOX_ROOT = originalEnv;
    }
  });

  it('returns the env-driven path when STORYBOOK_SANDBOX_ROOT/<sandboxKey>/node_modules/storybook exists', () => {
    // Materialise <tmpRoot>/react-vite-default-ts/node_modules/storybook so the
    // existsSync probe inside resolveSandboxDir succeeds at the first candidate.
    const sandboxKey = 'react-vite-default-ts';
    const storybookDir = path.join(tmpRoot, sandboxKey, 'node_modules', 'storybook');
    mkdirSync(storybookDir, { recursive: true });

    process.env.STORYBOOK_SANDBOX_ROOT = tmpRoot;

    const resolved = resolveSandboxDir('react-vite/default-ts');
    expect(resolved).toBe(path.join(tmpRoot, sandboxKey));
  });

  it('throws when STORYBOOK_SANDBOX_ROOT is set but the sandbox tree is missing AND no fallback exists', () => {
    process.env.STORYBOOK_SANDBOX_ROOT = path.join(tmpRoot, 'definitely-missing');
    // Note: this assertion is best-effort — if a developer has a real
    // ../storybook-sandboxes/react-vite-default-ts/node_modules/storybook
    // alongside the repo, resolveSandboxDir will fall back to it. The unit
    // test asserts only that the env-driven candidate was probed first and
    // the error message includes the env-driven path when no fallback
    // exists. We catch and inspect rather than rely on the throw shape.
    try {
      const result = resolveSandboxDir('react-vite/default-ts');
      // If a fallback exists we accept it as long as it is NOT the env path.
      expect(result.startsWith(tmpRoot)).toBe(false);
    } catch (err) {
      expect(String(err)).toContain('definitely-missing');
    }
  });
});
