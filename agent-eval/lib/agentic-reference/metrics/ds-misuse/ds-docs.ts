// The design system's own documentation, as the judge reads it.
//
// Pinned to one immutable sha, and deliberately NOT the branch the arm under
// evaluation was served. Content variation between arms is the independent
// variable of the whole agentic-reference round — several arms run against
// deliberately degraded documentation, which is exactly the condition we expect
// misuse to show up under. Judging each arm against the docs it happened to see
// would make the arms incomparable and would score a degraded arm against a
// lowered bar. Every arm is judged against the complete guidelines.
//
// Moving this pin is a deliberate, reviewable edit. Artifacts record the ref
// they were judged against, so a moved pin invalidates them rather than silently
// mixing two standards in one table.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { prepareRef, type ExternalRepoPin } from '../../external-repo.ts';

/**
 * yannbf/droppy-ds at main, 2026-08-14. 43 MDX files: 33 component docs plus
 * src/docs/, of which BrandGuidelines, ChoosingComponents, TechnicalGuidelines
 * and AccessibilityGuidelines carry the rules the judge scores against.
 */
export const DS_DOCS_PIN: ExternalRepoPin = {
  repo: 'yannbf/droppy-ds',
  ref: 'dfe7e43eeb2ff25c95897e55e86a976ef3f7cb7d',
};

/** Directories under the DS repo whose MDX is guidance rather than scaffolding. */
const DOC_ROOTS = ['src/components', 'src/docs'];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'storybook-static']);

export interface DsDoc {
  /** Repo-relative path, for citing in the prompt. */
  path: string;
  text: string;
}

/** `repo@sha`, recorded in every artifact so a moved pin invalidates it. */
export function dsDocsRefLabel(): string {
  return `${DS_DOCS_PIN.repo}@${DS_DOCS_PIN.ref}`;
}

function mdxUnder(dir: string, root: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : mdxUnder(path, root);
    return entry.name.endsWith('.mdx') ? [relative(root, path)] : [];
  });
}

/**
 * Every guideline document at the pinned ref, sorted by path.
 *
 * Sorted because this block is the cached prefix of every judge request: a
 * readdir-order corpus would reorder between machines and miss the cache on
 * every first request.
 */
export function collectDsDocs(cacheDir: string): DsDoc[] {
  const root = prepareRef(cacheDir, DS_DOCS_PIN.repo, DS_DOCS_PIN.ref);
  const paths = DOC_ROOTS.flatMap((docRoot) => mdxUnder(join(root, docRoot), root)).sort();

  if (paths.length === 0) {
    throw new Error(
      `ds-misuse: no MDX found under ${DOC_ROOTS.join(' or ')} at ${dsDocsRefLabel()}. ` +
        'Judging against an empty corpus would produce confident nonsense; ' +
        'check DS_DOCS_PIN in lib/agentic-reference/metrics/ds-misuse/ds-docs.ts.'
    );
  }

  return paths.map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') }));
}
