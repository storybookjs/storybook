import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  VerifyTargetParseError,
  describeTarget,
  isValidTarget,
  parseTargetFromSpec,
} from './target.ts';

// EPIC-5.7 (target half) — @verify-target header parser: absent → internal-ui,
// valid internal-ui / sandbox:<fw>/<variant> parse into the discriminated
// union, invalid values throw, and the 30-line scan window edge holds.

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'verify-target-test-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeSpec(name: string, contents: string): string {
  const p = join(dir, name);
  writeFileSync(p, contents, 'utf-8');
  return p;
}

describe('parseTargetFromSpec', () => {
  it('absent header → { kind: "internal-ui" } (v6 default)', () => {
    const p = writeSpec('no-header.spec.ts', "test('x', () => {});\n");
    expect(parseTargetFromSpec(p)).toEqual({ kind: 'internal-ui' });
  });

  it('a missing/unreadable file → default internal-ui (no throw)', () => {
    expect(parseTargetFromSpec(join(dir, 'nope.spec.ts'))).toEqual({ kind: 'internal-ui' });
  });

  it('valid "internal-ui" header parses to the internal-ui variant', () => {
    const p = writeSpec('internal.spec.ts', '// @verify-target: internal-ui\n');
    expect(parseTargetFromSpec(p)).toEqual({ kind: 'internal-ui' });
  });

  it('valid sandbox header parses to { kind: "sandbox", template }', () => {
    const p = writeSpec('sandbox.spec.ts', '// @verify-target: sandbox:react-vite/default-ts\n');
    expect(parseTargetFromSpec(p)).toEqual({
      kind: 'sandbox',
      template: 'react-vite/default-ts',
    });
  });

  it('tolerates whitespace around the header value', () => {
    const p = writeSpec('spaced.spec.ts', '   //   @verify-target:   sandbox:nextjs-vite/default-ts   \n');
    expect(parseTargetFromSpec(p)).toEqual({
      kind: 'sandbox',
      template: 'nextjs-vite/default-ts',
    });
  });

  it('invalid value (uppercase / wrong shape) throws VerifyTargetParseError', () => {
    const bad = writeSpec('bad-upper.spec.ts', '// @verify-target: Sandbox:React-Vite/Default\n');
    expect(() => parseTargetFromSpec(bad)).toThrowError(VerifyTargetParseError);

    const bad2 = writeSpec('bad-shape.spec.ts', '// @verify-target: sandbox:react-vite\n');
    expect(() => parseTargetFromSpec(bad2)).toThrowError(VerifyTargetParseError);

    const bad3 = writeSpec('bad-word.spec.ts', '// @verify-target: production\n');
    expect(() => parseTargetFromSpec(bad3)).toThrowError(/Invalid @verify-target/);
  });

  it('a header on line 31 is OUT of the 30-line scan window → default internal-ui', () => {
    const padding = Array.from({ length: 30 }, (_, i) => `// filler ${i}`).join('\n');
    const p = writeSpec(
      'out-of-window.spec.ts',
      `${padding}\n// @verify-target: sandbox:react-vite/default-ts\n`
    );
    expect(parseTargetFromSpec(p)).toEqual({ kind: 'internal-ui' });
  });

  it('a header on line 30 is the last IN-window line → parsed', () => {
    const padding = Array.from({ length: 29 }, (_, i) => `// filler ${i}`).join('\n');
    const p = writeSpec(
      'edge-window.spec.ts',
      `${padding}\n// @verify-target: sandbox:vue3-vite/default-ts\n`
    );
    expect(parseTargetFromSpec(p)).toEqual({
      kind: 'sandbox',
      template: 'vue3-vite/default-ts',
    });
  });

  it('first matching header wins', () => {
    const p = writeSpec(
      'multi.spec.ts',
      '// @verify-target: internal-ui\n// @verify-target: sandbox:react-vite/default-ts\n'
    );
    expect(parseTargetFromSpec(p)).toEqual({ kind: 'internal-ui' });
  });
});

describe('isValidTarget', () => {
  it('accepts internal-ui and well-formed sandbox templates', () => {
    expect(isValidTarget('internal-ui')).toBe(true);
    expect(isValidTarget('sandbox:react-vite/default-ts')).toBe(true);
    expect(isValidTarget('sandbox:nextjs-vite/default-ts')).toBe(true);
  });

  it('rejects malformed / cased / partial targets', () => {
    expect(isValidTarget('sandbox:react-vite')).toBe(false);
    expect(isValidTarget('sandbox:React-Vite/Default')).toBe(false);
    expect(isValidTarget('internal-ui ')).toBe(false);
    expect(isValidTarget('')).toBe(false);
  });

  it('rejects empty post-slash segment and extra path segments', () => {
    // Trailing slash with no variant — `[a-z0-9-]+` requires ≥1 char after `/`.
    expect(isValidTarget('sandbox:react-vite/')).toBe(false);
    // A third `/<segment>` is outside the `<framework>/<variant>` grammar.
    expect(isValidTarget('sandbox:a/b/c')).toBe(false);
  });
});

describe('describeTarget round-trips the parsed shape', () => {
  it('internal-ui → "internal-ui"', () => {
    expect(describeTarget({ kind: 'internal-ui' })).toBe('internal-ui');
  });

  it('sandbox → "sandbox:<template>"', () => {
    expect(describeTarget({ kind: 'sandbox', template: 'react-vite/default-ts' })).toBe(
      'sandbox:react-vite/default-ts'
    );
  });
});
