import { readFileSync, writeFileSync } from 'node:fs';

import * as find from 'empathic/find';
import { join } from 'pathe';

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
export const MIN_SUPPORTED_NODE_DESCRIPTION = MIN_SUPPORTED_NODE_VERSIONS.map(
  formatMinVersion
).join(' or ');

/**
 * Check whether a Node.js version (major.minor.patch) meets the minimum requirement.
 *
 * A version is supported if:
 * - It matches one of the defined major versions AND meets that major's minor.patch minimum
 * - Its major version is above the highest defined major (future-proofing)
 */
export function isNodeVersionSupported(major: number, minor: number, patch: number): boolean {
  const maxDefinedMajor = Math.max(...MIN_SUPPORTED_NODE_VERSIONS.map((v) => v.major));

  if (major > maxDefinedMajor) {
    return true;
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
 * Parse a Node.js version string into { major, minor, patch }.
 *
 * Handles formats: "v22.14.2", "22.14.2", "20.19", "18".
 * Returns undefined for unparseable values (e.g., "lts/*", "lts/hydrogen", "").
 */
export function parseNodeVersionString(
  str: string
): { major: number; minor: number; patch: number } | undefined {
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
  };
}

export interface DeclaredNodeVersions {
  nvmrcPath: string | undefined;
  nvmrcVersion: string | undefined;
  enginesNode: string | undefined;
  packageJsonPath: string | undefined;
}

/**
 * Detect declared Node.js version from .nvmrc and package.json engines.node.
 *
 * @param cwd - Directory to search from (defaults to process.cwd())
 */
export function detectDeclaredNodeVersions(cwd?: string): DeclaredNodeVersions {
  const result: DeclaredNodeVersions = {
    nvmrcPath: undefined,
    nvmrcVersion: undefined,
    enginesNode: undefined,
    packageJsonPath: undefined,
  };

  // Check .nvmrc
  try {
    const nvmrcPath = find.up('.nvmrc', { cwd });
    if (nvmrcPath) {
      const content = readFileSync(nvmrcPath, 'utf-8').trim();
      const parsed = parseNodeVersionString(content);
      if (parsed) {
        result.nvmrcPath = nvmrcPath;
        result.nvmrcVersion = content.replace(/^v/i, '').trim();
      }
    }
  } catch {
    // .nvmrc not readable — skip
  }

  // Check package.json engines.node
  try {
    const packageJsonPath = cwd ? join(cwd, 'package.json') : 'package.json';
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    const enginesNode = packageJson?.engines?.node;
    if (typeof enginesNode === 'string' && enginesNode.trim()) {
      result.enginesNode = enginesNode;
      result.packageJsonPath = packageJsonPath;
    }
  } catch {
    // package.json not readable or no engines — skip
  }

  return result;
}

/** Write a new version string to an .nvmrc file. */
export function updateNvmrc(filePath: string, version: string): void {
  writeFileSync(filePath, `${version}\n`, 'utf-8');
}

/** Update the engines.node field in a package.json file, preserving formatting. */
export function updateEnginesNode(packageJsonPath: string, range: string): void {
  const content = readFileSync(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);

  if (!packageJson.engines) {
    packageJson.engines = {};
  }
  packageJson.engines.node = range;

  // Detect indentation from the original file
  const indentMatch = content.match(/^(\s+)"/m);
  const indent = indentMatch ? indentMatch[1].length : 2;

  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, indent) + '\n', 'utf-8');
}
