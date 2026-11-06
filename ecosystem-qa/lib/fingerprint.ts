import { createHash } from 'node:crypto';

import type { Finding, RepoClass } from './types.ts';

const SIGNATURE_RULES: readonly (readonly [RegExp, string])[] = [
  [/\\/g, '/'],
  [/\b(?:https?|file):\/\/\S+/g, '<url>'],
  [/(?:^|(?<=[\s'"`(=]))(?:[a-z]:\/|~\/|\.{1,2}\/|\/)\S*/g, '<path>'],
  [/\S*node_modules\/\S*/g, '<path>'],
  [/\bv?\d+\.\d+(?:\.\d+)?(?:-[0-9a-z.-]+)?\b/g, '<version>'],
  [/:\d+(?::\d+)?\b/g, ''],
  [/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,}\b/g, '<hash>'],
  [/\s+/g, ' '],
];

export const normalizeErrorSignature = (text: string): string =>
  SIGNATURE_RULES.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
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
