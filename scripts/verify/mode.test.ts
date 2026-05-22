import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { VerifyModeParseError, isValidMode, parseModeFromSpec } from './mode.ts';

// EPIC-5.7 (mode half) — @verify-mode header parser: absent header → default
// visual, valid values parse, invalid values throw, and the 30-line scan
// window is enforced (a header on line 31 is NOT seen → default).

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'verify-mode-test-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeSpec(name: string, contents: string): string {
  const p = join(dir, name);
  writeFileSync(p, contents, 'utf-8');
  return p;
}

describe('parseModeFromSpec', () => {
  it('absent header → default "visual" (back-compat)', () => {
    const p = writeSpec('no-header.spec.ts', "import { test } from './_util.ts';\ntest('x', () => {});\n");
    expect(parseModeFromSpec(p)).toBe('visual');
  });

  it('a missing/unreadable file → default "visual" (no throw)', () => {
    expect(parseModeFromSpec(join(dir, 'does-not-exist.spec.ts'))).toBe('visual');
  });

  it.each(['visual', 'behavioral', 'pure-fn', 'build-config'] as const)(
    'parses valid value "%s"',
    (mode) => {
      const p = writeSpec(`valid-${mode}.spec.ts`, `// @verify-mode: ${mode}\ntest('x', () => {});\n`);
      expect(parseModeFromSpec(p)).toBe(mode);
    }
  );

  it('tolerates leading whitespace and extra spacing in the header', () => {
    const p = writeSpec('spaced.spec.ts', '   //   @verify-mode:   behavioral   \n');
    expect(parseModeFromSpec(p)).toBe('behavioral');
  });

  it('invalid value throws VerifyModeParseError with the offending value', () => {
    const p = writeSpec('invalid.spec.ts', '// @verify-mode: type-only\n');
    expect(() => parseModeFromSpec(p)).toThrowError(VerifyModeParseError);
    expect(() => parseModeFromSpec(p)).toThrowError(/type-only/);
  });

  it('a header on line 31 is OUT of the 30-line scan window → default visual', () => {
    const padding = Array.from({ length: 30 }, (_, i) => `// filler ${i}`).join('\n');
    const p = writeSpec('out-of-window.spec.ts', `${padding}\n// @verify-mode: behavioral\n`);
    // 30 filler lines occupy lines 1..30; the header is line 31 → not scanned.
    expect(parseModeFromSpec(p)).toBe('visual');
  });

  it('a header on line 30 is the last IN-window line → parsed', () => {
    const padding = Array.from({ length: 29 }, (_, i) => `// filler ${i}`).join('\n');
    const p = writeSpec('edge-window.spec.ts', `${padding}\n// @verify-mode: pure-fn\n`);
    // 29 filler (lines 1..29) + header on line 30 → in window.
    expect(parseModeFromSpec(p)).toBe('pure-fn');
  });

  it('first matching header wins when multiple are present', () => {
    const p = writeSpec('multi.spec.ts', '// @verify-mode: behavioral\n// @verify-mode: pure-fn\n');
    expect(parseModeFromSpec(p)).toBe('behavioral');
  });
});

describe('isValidMode', () => {
  it('accepts the four canonical modes only', () => {
    expect(isValidMode('visual')).toBe(true);
    expect(isValidMode('behavioral')).toBe(true);
    expect(isValidMode('pure-fn')).toBe(true);
    expect(isValidMode('build-config')).toBe(true);
  });

  it('rejects unknown / excluded modes', () => {
    expect(isValidMode('type-only')).toBe(false);
    expect(isValidMode('')).toBe(false);
    expect(isValidMode('VISUAL')).toBe(false);
  });
});
