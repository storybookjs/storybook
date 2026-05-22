import { describe, expect, it } from 'vitest';

import { DENY_PATTERNS, assertNoDeniedPatterns } from './recipe-deny.ts';

// EPIC-5.1 — every DENY pattern must fire on a real match, must report the
// accurate 1-based line number, and (per the documented security model in
// recipe-deny.ts) the deny-regex is a TRIPWIRE: a pure per-line regex pass
// with NO comment awareness, so a match inside a `//` comment STILL fires by
// design. These tests pin that ACTUAL observed behavior.
//
// IMPORTANT semantics pinned here: assertNoDeniedPatterns iterates
// DENY_PATTERNS in order and throws on the FIRST pattern (table order) that
// matches ANY line. Many real tokens legitimately match more than one
// pattern (e.g. `require('child_process')` matches both `child_process` and
// `require(child_process)`; an `import('node:x')` matches both `import node:`
// and `dynamic import(`). So the reported label is the first table entry that
// matches — we compute that expectation from the real DENY_PATTERNS array
// rather than assuming it equals the pattern we are probing.

// A representative real source line that triggers each pattern, keyed by the
// pattern label. Some intentionally also satisfy an earlier pattern; the
// per-pattern test computes the true first-match label below.
const REAL_MATCH_BY_LABEL: Record<string, string> = {
  child_process: "import { exec } from 'child_process';",
  'fs.unlink*': 'await fs.unlinkSync(target);',
  'fs.rm': 'fs.rm(dir);',
  'fs.rmdir': 'fs.rmdir(dir);',
  'fsp.unlink*': 'await fsp.unlink(target);',
  'fsp.rm': 'await fsp.rm(dir);',
  'process.exit': 'process.exit(1);',
  'eval(': 'const x = eval("1+1");',
  // `import node:` regex is /\bimport\s+['"`]node:/ — it matches a BARE
  // side-effect import (`import 'node:os'`), NOT `import x from 'node:os'`
  // (that form is covered by the `from node:` patterns instead).
  'import node:': "import 'node:os';",
  'from node: (named import)': "import { readFile } from 'node:fs';",
  'require(node:)': "const os = require('node:os');",
  'require(child_process)': "const cp = require('child_process');",
  'dynamic import(': "const mod = await import('./evil.ts');",
  'from node: (any module)': "import { setTimeout } from 'node:timers';",
  createRequire: 'const req = createRequire(import.meta.url);',
  'process.mainModule': 'process.mainModule.require("fs");',
  'process.binding': 'process.binding("fs");',
  'globalThis[': 'globalThis["pro" + "cess"];',
  'import @playwright/test': "import { test } from '@playwright/test';",
};

// Mirror the source's exact resolution: the first DENY_PATTERNS entry (table
// order) whose regex matches the line is the one that gets reported.
function firstMatchingLabel(line: string): string | undefined {
  for (const [label, regex] of DENY_PATTERNS) {
    if (regex.test(line)) return label;
  }
  return undefined;
}

describe('recipe-deny DENY_PATTERNS coverage', () => {
  it('has a real-match sample for every declared pattern (no drift)', () => {
    const labels = DENY_PATTERNS.map(([label]) => label);
    expect(labels.slice().sort()).toEqual(Object.keys(REAL_MATCH_BY_LABEL).sort());
  });

  for (const [label, regex] of DENY_PATTERNS) {
    describe(`pattern "${label}"`, () => {
      it('its own sample line matches its own regex', () => {
        expect(regex.test(REAL_MATCH_BY_LABEL[label])).toBe(true);
      });

      it('fires on a real match and reports the accurate 1-based line', () => {
        const sample = REAL_MATCH_BY_LABEL[label];
        const expectedLabel = firstMatchingLabel(sample);
        expect(expectedLabel).toBeDefined();

        // Place the offending line on line 3 (1-based) so we assert the
        // reported line number precisely, not just "throws".
        const source = ['// header', 'const a = 1;', sample, 'const b = 2;'].join('\n');
        let thrown: Error | undefined;
        try {
          assertNoDeniedPatterns(source);
        } catch (err) {
          thrown = err as Error;
        }
        expect(thrown).toBeDefined();
        expect(thrown!.message).toContain(`denied pattern "${expectedLabel}"`);
        expect(thrown!.message).toContain('at line 3:');
      });

      it('STILL fires when the match is inside a // comment (tripwire has no comment awareness)', () => {
        // recipe-deny.ts SECURITY MODEL header: this is a per-line regex
        // tripwire, NOT comment-aware. A commented-out match must still trip.
        // We assert it throws AND that the reported label is the true
        // first-match (matches actual behavior, not an assumption).
        const sample = REAL_MATCH_BY_LABEL[label];
        const source = `// ${sample}`;
        const expectedLabel = firstMatchingLabel(source);
        expect(expectedLabel).toBeDefined();
        let thrown: Error | undefined;
        try {
          assertNoDeniedPatterns(source);
        } catch (err) {
          thrown = err as Error;
        }
        expect(thrown, `commented "${sample}" must still trip the tripwire`).toBeDefined();
        expect(thrown!.message).toContain(`denied pattern "${expectedLabel}"`);
        expect(thrown!.message).toContain('at line 1:');
      });
    });
  }

  it('does not throw on clean source with no denied tokens', () => {
    const clean = [
      "import { test, expect } from './_util.ts';",
      "test('renders', async ({ page }) => {",
      "  await page.goto('/');",
      "  await expect(page).toHaveTitle(/Storybook/);",
      '});',
    ].join('\n');
    expect(() => assertNoDeniedPatterns(clean)).not.toThrow();
  });

  it('reports the FIRST denied pattern in DENY_PATTERNS order, not the first source line', () => {
    // `child_process` is the first entry in DENY_PATTERNS. Even though the
    // eval() match appears on an earlier source line, the OUTER loop is over
    // patterns, so child_process is reported first.
    const source = ['const x = eval("1");', "require('child_process');"].join('\n');
    expect(() => assertNoDeniedPatterns(source)).toThrowError(/denied pattern "child_process"/);
  });

  it('a sample that uniquely matches only its pattern reports exactly that label', () => {
    // `eval(` is not a substring of any other pattern; verify the isolated
    // reporting path end-to-end.
    expect(firstMatchingLabel('const x = eval("1+1");')).toBe('eval(');
    expect(() => assertNoDeniedPatterns('const x = eval("1+1");')).toThrowError(
      /denied pattern "eval\(" matched at line 1:/
    );
  });
});

describe('recipe-deny eval-#36 regression pin', () => {
  // eval-#36: a `dynamic import(` style construct must be DENIED. This is the
  // C6 extension (recipe-deny.ts:28-30) closing the obfuscated dynamic-import
  // bypass. Pin it explicitly so a future refactor cannot silently drop it.
  it('the `dynamic import(` pattern is present in DENY_PATTERNS', () => {
    const labels = DENY_PATTERNS.map(([l]) => l);
    expect(labels).toContain('dynamic import(');
  });

  it('denies a bare dynamic import() of a relative path (isolated → exact label/line)', () => {
    const source = ['const ok = 1;', "await import('./loader.ts');"].join('\n');
    // `./loader.ts` matches ONLY `dynamic import(` (no node: / require), so the
    // exact label + line is deterministic.
    expect(firstMatchingLabel("await import('./loader.ts');")).toBe('dynamic import(');
    expect(() => assertNoDeniedPatterns(source)).toThrowError(
      /denied pattern "dynamic import\(" matched at line 2:/
    );
  });

  it('denies a dynamic import( of a node: specifier (rejected — earliest table match wins)', () => {
    const line = "const evil = await import('node:child_process');";
    // This line matches MULTIPLE patterns: `child_process` (table index 0,
    // /\bchild_process\b/), `import node:` (index 8), and `dynamic import(`
    // (index 12). Table order wins, so `child_process` is the reported label.
    // The PIN is behavioral: a dynamic import() of a node: child_process
    // specifier is REJECTED regardless of WHICH overlapping label fires.
    const expectedLabel = firstMatchingLabel(line);
    expect(expectedLabel).toBe('child_process');
    expect(() => assertNoDeniedPatterns(line)).toThrowError(
      new RegExp(`denied pattern "${expectedLabel!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`)
    );
    // And independently: the dynamic-import construct on its own (no node:)
    // is caught by the dedicated `dynamic import(` rule.
    expect(firstMatchingLabel("await import(maybeEvil);")).toBe('dynamic import(');
  });
});
