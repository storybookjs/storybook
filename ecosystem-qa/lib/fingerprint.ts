import { createHash } from 'node:crypto';

import type { Finding, RepoClass } from './types.ts';

// A path keeps the part that names what failed (the package under node_modules, or the last two
// segments of a project file) and loses the checkout prefix, which differs per machine.
const lastTwoSegments = (path: string): string =>
  path.split('/').filter(Boolean).slice(-2).join('/');

const SIGNATURE_RULES: readonly (readonly [RegExp, string | ((match: string) => string)])[] = [
  [/\\/g, '/'],
  [/\b(?:https?|file):\/\/\S+/g, '<url>'],
  [/\S*?(node_modules\/\S*)/g, '$1'],
  [/(?:^|(?<=[\s'"`(=]))(?:[a-z]:\/|~\/|\.{1,2}\/|\/)\S*/g, lastTwoSegments],
  [/\bv?\d+\.\d+(?:\.\d+)?(?:-[0-9a-z.-]+)?\b/g, '<version>'],
  [/:\d+(?::\d+)?\b/g, ''],
  [/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,}\b/g, '<hash>'],
  [/\s+/g, ' '],
];

export const normalizeErrorSignature = (text: string): string =>
  SIGNATURE_RULES.reduce(
    (current, [pattern, replacement]) =>
      typeof replacement === 'string'
        ? current.replace(pattern, replacement)
        : current.replace(pattern, replacement),
    text.toLowerCase()
  ).trim();

// The Storybook version is never an input, so one bug keeps its fingerprint across prereleases.
export const fingerprint = (finding: Finding, repoClass: RepoClass): string =>
  createHash('sha256')
    .update(
      `${finding.checkId}|${repoClass}|${normalizeErrorSignature(finding.errorText ?? finding.actual)}`
    )
    .digest('hex')
    .slice(0, 16);
