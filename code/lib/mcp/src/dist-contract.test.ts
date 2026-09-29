/**
 * Guards what this package ships.
 *
 * `@storybook/mcp` serves hosted Storybooks and must stay installable without Storybook itself, so
 * the shared formatter it imports from core is bundled rather than depended on. Both halves of that
 * bargain are easy to break silently — an unbundled import would fail at a consumer's runtime, and
 * tree-shaking regressions only show up as a bigger tarball — so both are asserted here, for the
 * runtime bundle and for the declarations alike.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import packageJson from '../package.json' with { type: 'json' };

const DIST_ENTRY = join(import.meta.dirname, '../dist/index.js');
const DTS_ENTRY = join(import.meta.dirname, '../dist/index.d.ts');
const README = join(import.meta.dirname, '../README.md');

/**
 * Markdown links, minus in-page anchors: a target is relative unless it names a scheme.
 *
 * The README is the only prose in the tarball, and it is read from `node_modules` as often as from
 * npmjs.com. A repo-relative target resolves to nothing there, so it would point a reader at a file
 * this package does not publish.
 */
const MARKDOWN_LINK_RE = /\]\(([^)#][^)]*)\)/g;

/** Reference-style link definitions, e.g. `[serve]: ./serve.ts` — the other way to write a link. */
const REFERENCE_LINK_DEFINITION_RE = /^ {0,3}\[[^\]]+\]:\s*([^\s#][^\s]*)/gm;

/**
 * Fenced code blocks and inline code spans, stripped before link matching runs.
 *
 * The README is majority TypeScript snippets, and destructuring/index syntax like
 * `handlers['docs-list'](ctx)` contains a `](` sequence that reads as a Markdown link to a bare
 * regex; without stripping, every such snippet is a false positive that grows with every example.
 */
function stripCode(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`\n]*`/g, '');
}

/** Every link target the README writes, in either form, minus in-page anchors and code examples. */
function markdownLinkTargets(markdown: string): string[] {
  const prose = stripCode(markdown);
  return [
    ...[...prose.matchAll(MARKDOWN_LINK_RE)].map(([, target]) => target),
    ...[...prose.matchAll(REFERENCE_LINK_DEFINITION_RE)].map(([, target]) => target),
  ];
}

/**
 * Headroom over the current size, so ordinary edits pass but a bundling regression does not.
 *
 * The budget stepped up when this package moved from shipping its own docs tools to bundling
 * Storybook's shared docs toolset — the engine it used to duplicate now arrives from core.
 */
const SIZE_BUDGET_BYTES = 85_000;

/**
 * The declarations are bundled from per-file emit and tree-shaken (~39 KB today). When they were
 * accidentally bundled from core's chunked dist declarations instead, one imported symbol dragged
 * whole unrelated type surfaces along — a 196 KB d.ts importing `react` — so the budget also
 * guards the bundling strategy, not just growth.
 */
const DTS_SIZE_BUDGET_BYTES = 60_000;

/**
 * Every import form that would leave a `storybook` module reference in a shipped artifact:
 * static `from`, CommonJS `require(...)`, dynamic `import(...)`, and side-effect `import "..."`.
 * Matches both bare `storybook` and any `storybook/*` subpath.
 */
const STORYBOOK_IMPORT_RE =
  /(?:\bfrom\s*|\brequire\(\s*|\bimport\(\s*|\bimport\s+)["']storybook(?:["']|\/)/;

/**
 * The dist-reading assertions are skipped on a working copy that has not been built, which would
 * make them pass vacuously in CI — where a build always precedes the tests. So there, its absence
 * is the failure.
 */
const DIST_BUILT = existsSync(DIST_ENTRY);
const DTS_BUILT = existsSync(DTS_ENTRY);

describe('published package contract', () => {
  it.runIf(process.env.CI)('is built before this suite runs', () => {
    expect(DIST_BUILT).toBe(true);
    expect(DTS_BUILT).toBe(true);
  });

  it('declares no runtime dependency on storybook', () => {
    const manifest = packageJson as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(Object.keys(manifest.dependencies ?? {})).not.toContain('storybook');
    expect(Object.keys(manifest.peerDependencies ?? {})).not.toContain('storybook');
    expect(Object.keys(manifest.devDependencies ?? {})).toContain('storybook');
  });

  it.runIf(DIST_BUILT)('bundles what it imports from storybook', () => {
    expect(readFileSync(DIST_ENTRY, 'utf-8')).not.toMatch(STORYBOOK_IMPORT_RE);
  });

  it.runIf(DIST_BUILT)('stays within its size budget', () => {
    expect(statSync(DIST_ENTRY).size).toBeLessThan(SIZE_BUDGET_BYTES);
  });

  // No single-valibot assertion (yet): `valibot` is a real dependency, but a second copy arrives
  // pre-inlined inside core's prebuilt browser chunks, which the runtime bundle consumes.
  // Externalizing that copy would mean bundling core from source — a rebundling of the shipped
  // runtime deferred until the JS bundling moves to source. The duplicated copy only ever
  // validates core-authored schemas, so the two cannot skew per input.

  it.runIf(DTS_BUILT)('ships declarations a pure-Node consumer can check', () => {
    const declarations = readFileSync(DTS_ENTRY, 'utf-8');

    // No react (nor any module reference to it, including subpaths like react/jsx-runtime):
    // consumers of this package have no @types/react, and `skipLibCheck: false` must keep
    // working for them.
    expect(declarations).not.toMatch(/["']react(?:["']|\/)/);
    expect(declarations).not.toMatch(STORYBOOK_IMPORT_RE);
  });

  it('links only to targets that exist outside the repository', () => {
    const targets = markdownLinkTargets(readFileSync(README, 'utf-8'));

    expect(targets.filter((target) => !/^[a-z]+:/i.test(target))).toEqual([]);
  });

  describe('markdownLinkTargets', () => {
    it('does not mistake code-fence syntax for a link', () => {
      const snippet = "```ts\nconst run = handlers['docs-list'](ctx);\n```";

      expect(markdownLinkTargets(snippet)).toEqual([]);
    });

    it('does not mistake an inline code span for a link', () => {
      expect(markdownLinkTargets('Call `tools[K](server)` to register.')).toEqual([]);
    });

    it('catches a reference-style link definition, the other way to write a relative link', () => {
      const markdown = '[serve]: ./serve.ts\n\nSee [serve][serve] for the harness.';

      expect(markdownLinkTargets(markdown)).toEqual(['./serve.ts']);
    });
  });

  it.runIf(DTS_BUILT)('keeps the declarations within their size budget', () => {
    expect(statSync(DTS_ENTRY).size).toBeLessThan(DTS_SIZE_BUDGET_BYTES);
  });
});
