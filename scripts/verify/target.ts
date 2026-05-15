// Parses the `@verify-target` header from a Playwright recipe spec file.
//
// Recipe header convention (scanned in the first 30 lines):
//
//   // @verify-target: internal-ui
//   // @verify-target: sandbox:<template>   e.g. sandbox:react-vite/default-ts
//
// Absent header → internal-ui (the v6 default). Invalid header values throw.

import { readFileSync } from 'node:fs';

export type VerifyTarget =
  | { kind: 'internal-ui' }
  | { kind: 'sandbox'; template: string };

const HEADER_RE = /^\s*\/\/\s*@verify-target:\s*(\S+)\s*$/;
const TARGET_RE = /^(internal-ui|sandbox:[a-z0-9-]+\/[a-z0-9-]+)$/;
const HEADER_SCAN_LINES = 30;
const DEFAULT_TARGET: VerifyTarget = { kind: 'internal-ui' };

export class VerifyTargetParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerifyTargetParseError';
  }
}

export function isValidTarget(s: string): boolean {
  return TARGET_RE.test(s);
}

export function parseTargetFromSpec(specPath: string): VerifyTarget {
  let raw: string;
  try {
    raw = readFileSync(specPath, 'utf-8');
  } catch {
    return DEFAULT_TARGET;
  }
  const lines = raw.split('\n').slice(0, HEADER_SCAN_LINES);
  for (const line of lines) {
    const match = HEADER_RE.exec(line);
    if (!match) continue;
    const value = match[1];
    if (!isValidTarget(value)) {
      throw new VerifyTargetParseError(
        `Invalid @verify-target in ${specPath}: ${value}. Expected "internal-ui" or "sandbox:<framework>/<variant>" with lowercase letters, digits, and hyphens.`
      );
    }
    if (value === 'internal-ui') return { kind: 'internal-ui' };
    return { kind: 'sandbox', template: value.slice('sandbox:'.length) };
  }
  return DEFAULT_TARGET;
}

/**
 * @deprecated inline at the one call site if it remains a single caller after the W5 cleanup.
 */
export function describeTarget(target: VerifyTarget): string {
  return target.kind === 'sandbox' ? `sandbox:${target.template}` : 'internal-ui';
}
