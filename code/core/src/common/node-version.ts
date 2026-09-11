import { satisfies } from 'semver';

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

/**
 * Check whether a Node.js version (major.minor.patch) meets the minimum requirement.
 *
 * Missing version components should be normalized by callers (e.g. "22" -> 22.0.0).
 */
export function isNodeVersionSupported(major: number, minor: number, patch: number): boolean {
  const sortedMinimums = [...MIN_SUPPORTED_NODE_VERSIONS].sort((a, b) => a.major - b.major);
  const supportedRange = sortedMinimums
    .map((min, index) => {
      const next = sortedMinimums[index + 1];
      const lowerBound = `>=${min.major}.${min.minor}.${min.patch}`;

      if (next) {
        return `${lowerBound} <${next.major}.0.0`;
      }

      return lowerBound;
    })
    .join(' || ');

  return satisfies(`${major}.${minor}.${patch}`, supportedRange);
}

/**
 * Parse a Node.js version string (e.g. `process.versions.node`) into its
 * major/minor/patch components.
 *
 * Prerelease and build-metadata segments are stripped before parsing, so that
 * prerelease builds of a supported version (e.g. `24.0.0-rc.1` or
 * `20.19.0-nightly20240519abcdef`) are recognized as supported instead of
 * producing a `NaN` patch component. Missing components are normalized to 0
 * (e.g. "22" -> 22.0.0), matching the normalization expected by
 * {@link isNodeVersionSupported}.
 */
export function parseNodeVersion(version: string = process.versions.node): MinNodeVersion {
  const [major = 0, minor = 0, patch = 0] = version
    .split('-')[0]
    .split('+')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);

  return { major, minor, patch };
}
