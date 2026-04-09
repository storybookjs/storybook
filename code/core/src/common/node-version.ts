import { readFileSync, writeFileSync } from 'node:fs';

import * as find from 'empathic/find';
import detectIndent from 'detect-indent';
import { join } from 'pathe';

import { getProjectRoot } from './utils/paths.ts';

export interface MinNodeVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Minimum Node.js versions supported by Storybook.
 * This is the single source of truth — all version checks should reference this.
 */
export const MIN_SUPPORTED_NODE_VERSIONS: readonly MinNodeVersion[] = [
  { major: 20, minor: 19, patch: 0 },
  { major: 22, minor: 12, patch: 0 },
];

/**
 * Format a MinNodeVersion for human display:
 * - { major: 20, minor: 0, patch: 0 } → "20+"
 * - { major: 20, minor: 19, patch: 0 } → "20.19+"
 * - { major: 22, minor: 22, patch: 1 } → "22.22.1+"
 */
export function formatMinVersion(v: MinNodeVersion): string {
  if (v.minor === 0 && v.patch === 0) {
    return `${v.major}+`;
  }
  if (v.patch === 0) {
    return `${v.major}.${v.minor}+`;
  }
  return `${v.major}.${v.minor}.${v.patch}+`;
}

/** Human-readable description like "20.19+ or 22.12+" */
export const MIN_SUPPORTED_NODE_DESCRIPTION =
  MIN_SUPPORTED_NODE_VERSIONS.map(formatMinVersion).join(' or ');

/** Precision of a parsed Node.js version string: how many components were specified. */
export type NodeVersionPrecision = 'major' | 'minor' | 'patch';

/**
 * Check whether a Node.js version (major.minor.patch) meets the minimum requirement.
 *
 * **`mode: 'strict'`** (default — use for runtime version checks):
 * - Treats missing minor/patch as 0 (`"22"` → 22.0.0, which is NOT supported).
 * - A version is supported if its major matches one of the defined supported majors
 *   and its minor.patch meets that major's minimum, or its major is above the highest defined.
 *
 * **`mode: 'permissive'`** (use when checking a declared `.nvmrc` version):
 * - Treats missing components as "latest of that level" instead of 0.
 * - `precision: 'major'` (e.g. `"22"`): supported if the major itself appears in
 *   MIN_SUPPORTED_NODE_VERSIONS (meaning some supported version exists for that major).
 * - `precision: 'minor'` (e.g. `"22.14"`): supported if the declared minor meets or
 *   exceeds the minimum minor for that major.
 * - `precision: 'patch'`: same as strict mode.
 */
export function isNodeVersionSupported(
  major: number,
  minor: number,
  patch: number,
  {
    mode = 'strict',
    precision = 'patch',
  }: { mode?: 'strict' | 'permissive'; precision?: NodeVersionPrecision } = {}
): boolean {
  const maxDefinedMajor = Math.max(...MIN_SUPPORTED_NODE_VERSIONS.map((v) => v.major));

  if (major > maxDefinedMajor) {
    return true;
  }

  if (mode === 'permissive') {
    if (precision === 'major') {
      // "22" in .nvmrc means "latest 22.x" — supported if any supported version exists for major 22
      return MIN_SUPPORTED_NODE_VERSIONS.some((v) => v.major === major);
    }
    if (precision === 'minor') {
      // "22.14" in .nvmrc means "latest 22.14.x" — supported if 22.14 >= minimum minor for major 22
      return MIN_SUPPORTED_NODE_VERSIONS.some((v) => v.major === major && minor >= v.minor);
    }
    // precision === 'patch': fall through to strict comparison
  }

  return MIN_SUPPORTED_NODE_VERSIONS.some((min) => {
    if (major !== min.major) {
      return false;
    }
    if (minor !== min.minor) {
      return minor > min.minor;
    }
    return patch >= min.patch;
  });
}

/**
 * Parse a Node.js version string into { major, minor, patch, precision }.
 *
 * Handles formats: "v22.14.2", "22.14.2", "20.19", "18".
 * Returns undefined for unparseable values (e.g., "lts/*", "lts/hydrogen", "").
 *
 * `precision` reflects how many version components were present:
 *   "22"       → precision 'major'
 *   "22.14"    → precision 'minor'
 *   "22.14.2"  → precision 'patch'
 */
export function parseNodeVersionString(
  str: string
): { major: number; minor: number; patch: number; precision: NodeVersionPrecision } | undefined {
  const trimmed = str.trim().replace(/^v/i, '');

  if (!trimmed || !/^\d/.test(trimmed)) {
    return undefined;
  }

  const parts = trimmed.split('.').map(Number);

  if (parts.some((p) => Number.isNaN(p))) {
    return undefined;
  }

  return {
    major: parts[0],
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
    precision: parts.length >= 3 ? 'patch' : parts.length === 2 ? 'minor' : 'major',
  };
}
