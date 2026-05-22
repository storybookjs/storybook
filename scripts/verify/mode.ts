// Parses the `@verify-mode` header from a Playwright recipe spec file.
//
// Orthogonal to `@verify-target` (which picks WHERE the recipe runs —
// internal-ui vs a sandbox template). `@verify-mode` picks the verdict
// STRATEGY — what kind of test the recipe is and which downstream checks
// apply. Kept as a separate parser from target.ts on purpose: independent
// axes, isolated regex/validation.
//
// Recipe header convention (scanned in the first 30 lines):
//
//   // @verify-mode: visual        screenshot + vision evidence-check (default)
//   // @verify-mode: behavioral    Playwright asserts DOM/ARIA/console; no vision
//   // @verify-mode: pure-fn       focused vitest importing the changed symbol
//   // @verify-mode: build-config  assert built output / config effect
//
// Absent header → visual (back-compat: every existing recipe and the example
// keep current behavior with zero edits). Invalid values throw.
//
// NOTE: `type-only` was considered and deliberately excluded — differential
// `tsc` is too close to the differential-only verification approach the owner
// rejected. See scripts/verify/DESIGN-nonvisual-coverage.md.

import { readFileSync } from 'node:fs';

export type VerifyMode = 'visual' | 'behavioral' | 'pure-fn' | 'build-config';

const HEADER_RE = /^\s*\/\/\s*@verify-mode:\s*(\S+)\s*$/;
const HEADER_SCAN_LINES = 30;
const DEFAULT_MODE: VerifyMode = 'visual';
const VALID_MODES: readonly VerifyMode[] = ['visual', 'behavioral', 'pure-fn', 'build-config'];

export class VerifyModeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerifyModeParseError';
  }
}

export function isValidMode(s: string): s is VerifyMode {
  return (VALID_MODES as readonly string[]).includes(s);
}

export function parseModeFromSpec(specPath: string): VerifyMode {
  let raw: string;
  try {
    raw = readFileSync(specPath, 'utf-8');
  } catch {
    return DEFAULT_MODE;
  }
  const lines = raw.split('\n').slice(0, HEADER_SCAN_LINES);
  for (const line of lines) {
    const match = HEADER_RE.exec(line);
    if (!match) continue;
    const value = match[1];
    if (!isValidMode(value)) {
      throw new VerifyModeParseError(
        `Invalid @verify-mode in ${specPath}: ${value}. Expected one of: ${VALID_MODES.join(', ')}.`
      );
    }
    return value;
  }
  return DEFAULT_MODE;
}
