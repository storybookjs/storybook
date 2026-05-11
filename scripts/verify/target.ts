// Parses the `@verify-target` header from a Playwright recipe spec file.
//
// Recipe header convention (scanned in the first 30 lines):
//
//   // @verify-target: internal-ui
//   // @verify-target: sandbox:<template>   e.g. sandbox:react-vite/default-ts
//
// Absent or unrecognised header → internal-ui (the v6 default).

import { readFileSync } from 'node:fs';

export type VerifyTarget =
  | { kind: 'internal-ui' }
  | { kind: 'sandbox'; template: string };

const HEADER_RE = /^\s*\/\/\s*@verify-target:\s*(\S+)\s*$/;
const HEADER_SCAN_LINES = 30;
const DEFAULT_TARGET: VerifyTarget = { kind: 'internal-ui' };

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
    if (value === 'internal-ui') return { kind: 'internal-ui' };
    if (value.startsWith('sandbox:')) {
      const template = value.slice('sandbox:'.length);
      if (template.length === 0) return DEFAULT_TARGET;
      return { kind: 'sandbox', template };
    }
    return DEFAULT_TARGET;
  }
  return DEFAULT_TARGET;
}

export function describeTarget(target: VerifyTarget): string {
  return target.kind === 'sandbox' ? `sandbox:${target.template}` : 'internal-ui';
}
