import { createHash } from 'node:crypto';

import type { Finding, RepoClass } from './schema.ts';

// A path outside node_modules keeps only its file name: anything above it can be the checkout
// directory, whose name differs per repo, sandbox and machine.
const fileName = (path: string): string =>
  path
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..')
    .at(-1) ?? path;

const SIGNATURE_RULES: readonly ((text: string) => string)[] = [
  (text) => text.replace(/\\/g, '/'),
  // From the last node_modules/ on, which drops pnpm's .pnpm/<name>@<version>_<peers> store
  // directory and Yarn PnP cache prefixes along with the checkout.
  (text) => text.replace(/[^\s'"`]*node_modules\/(\S*)/g, 'node_modules/$1'),
  // After the node_modules rule, so a file:// URL into a package keeps the package. What is left
  // is a host the message names, which varies between runs.
  (text) => text.replace(/\b(?:https?|file):\/\/\S+/g, '<url>'),
  (text) => text.replace(/(?:^|(?<=[\s'"`(=]))(?:[a-z]:\/|~\/|\.{1,2}\/|\/)\S*/g, fileName),
  (text) => text.replace(/\bv?\d+\.\d+(?:\.\d+)?(?:-[0-9a-z.-]+)?\b/g, '<version>'),
  (text) => text.replace(/:\d+(?::\d+)?\b/g, ''),
  (text) => text.replace(/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,}\b/g, '<hash>'),
  (text) => text.replace(/\s+/g, ' '),
];

export const normalizeErrorSignature = (text: string): string =>
  SIGNATURE_RULES.reduce((current, rule) => rule(current), text.toLowerCase()).trim();

// The Storybook version is never an input, so one bug keeps its fingerprint across prereleases.
// It does depend on how much of the error the agent copied, so two agents can still fingerprint
// one bug differently; grouping by root cause is a separate pass (SB-2488).
export const fingerprint = (finding: Finding, repoClass: RepoClass): string =>
  createHash('sha256')
    .update(
      `${finding.checkId}|${repoClass}|${normalizeErrorSignature(finding.errorText?.trim() || finding.actual)}`
    )
    .digest('hex')
    .slice(0, 16);
