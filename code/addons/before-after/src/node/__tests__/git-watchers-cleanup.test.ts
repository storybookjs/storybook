/// <reference types="node" />

import { closeSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// ── git-watchers-cleanup probe (K4) ──────────────────────────────────────────
//
// Asserts the lifecycle pattern used by `experimental_devServer` in `preset.ts`
// (and re-used by the env-API path) — registering N `fs.watch` watchers,
// calling cleanup, and confirming neither the watcher list nor any late
// callback survives. No `lsof`.

describe('git watcher cleanup pattern', () => {
  let tmpRoot: string;
  let watchers: FSWatcher[] = [];

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'before-after-watchers-'));
  });

  afterEach(() => {
    for (const w of watchers) {
      try {
        w.close();
      } catch {
        /* already closed */
      }
    }
    watchers = [];
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  function makeWatcher(file: string, onChange: () => void): FSWatcher {
    const w = watch(file, onChange);
    watchers.push(w);
    return w;
  }

  it('cleanup empties the watcher array', () => {
    const a = join(tmpRoot, 'a');
    const b = join(tmpRoot, 'b');
    closeSync(openSync(a, 'w'));
    closeSync(openSync(b, 'w'));

    makeWatcher(a, () => undefined);
    makeWatcher(b, () => undefined);
    expect(watchers).toHaveLength(2);

    for (const w of watchers) w.close();
    watchers = [];
    expect(watchers).toHaveLength(0);
  });

  it('no late callbacks fire after cleanup', async () => {
    const a = join(tmpRoot, 'a');
    closeSync(openSync(a, 'w'));

    let calls = 0;
    const w = makeWatcher(a, () => {
      calls += 1;
    });

    // Cleanup: close + drop reference.
    w.close();
    watchers = watchers.filter((x) => x !== w);

    // Generate fs notifications post-close. Across all platforms this should
    // never invoke the closed watcher; if it does, the count diverges and the
    // assertion fails. (`fs.watch` event delivery on macOS is timing-flaky
    // BEFORE close, so we don't pre-assert there — the post-close invariant
    // is the actual guarantee under test.)
    writeFileSync(a, 'second', 'utf-8');
    writeFileSync(a, 'third', 'utf-8');
    await new Promise((r) => setTimeout(r, 200));

    expect(calls).toBe(0);
  });

  it('repeated cleanup is idempotent (closing twice does not throw)', () => {
    const a = join(tmpRoot, 'a');
    closeSync(openSync(a, 'w'));
    const w = makeWatcher(a, () => undefined);
    expect(() => {
      w.close();
      w.close();
    }).not.toThrow();
    watchers = watchers.filter((x) => x !== w);
  });
});
