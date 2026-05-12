/**
 * Experiment C — CSS blast-radius synthesis prototype.
 *
 * Change-detection is structurally CSS-blind: the parser doesn't walk
 * `.css/.scss/.sass/.less` imports, so editing a stylesheet emits 0
 * statuses even when the change is visually significant. This module
 * implements the deterministic gap-filler spec'd in
 * questions/02_DETERMINISTIC_VS_AI.md.
 *
 * Strategy: for each changed CSS file, find sibling JS/TS files in the
 * same directory, look up importing stories for each sibling via the
 * existing reverse index, union the result. This produces a
 * "may-be-affected" set whose precision is bounded by "co-located JS
 * imports the same look — true for design-system-style projects."
 */
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { normalize } from 'pathe';
import {
  ChangeDetectionResolverFactory,
  DependencyGraphBuilder,
  ParseResolveCache,
} from '../../../../code/core/src/core-server/change-detection/dependency-graph/index.ts';
import {
  ParserRegistry,
  builtinImportParsers,
} from '../../../../code/core/src/core-server/change-detection/parser-registry/index.ts';

export interface CssBlastResult {
  changedCssFile: string;
  /** Sibling files in the same directory whose importers we union. */
  siblingFiles: string[];
  /** Stories that transitively import any sibling. */
  importingStories: string[];
  /** Per-sibling breakdown for debugging. */
  perSibling: { sibling: string; storyCount: number }[];
}

const CSS_RE = /\.(css|scss|sass|less|styl)$/;
const JS_RE = /\.(tsx?|jsx?|mjs|cjs)$/;
const STORY_RE = /\.stories\.(tsx?|jsx?)$/;
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.cache']);

export async function computeCssBlastRadius(
  cssFiles: string[],
  projectRoot: string,
  alias: Record<string, string>
): Promise<CssBlastResult[]> {
  const storyFiles = await findStoryFiles(projectRoot);
  const silent = { debug: () => {}, warn: () => {} };
  const registry = new ParserRegistry({
    defaultParsers: builtinImportParsers,
    pluginParsers: [],
  });
  const resolver = new ChangeDetectionResolverFactory({ projectRoot, alias });
  const workspaceRoots = new Set([projectRoot]);
  const cache = new ParseResolveCache({
    registry,
    resolver,
    workspaceRoots,
    projectRoot,
    logger: silent,
  });
  const builder = new DependencyGraphBuilder({
    registry,
    resolver,
    workspaceRoots,
    projectRoot,
    cache,
    logger: silent,
  });
  const { reverseIndex } = await builder.build(storyFiles);

  const out: CssBlastResult[] = [];
  for (const css of cssFiles) {
    const absCss = normalize(css.startsWith('/') ? css : join(projectRoot, css));
    const dir = dirname(absCss);
    const siblings = await findSiblingsJs(dir);
    const all = new Set<string>();
    const perSibling: { sibling: string; storyCount: number }[] = [];
    for (const s of siblings) {
      const importers = reverseIndex.lookup(normalize(s));
      perSibling.push({ sibling: s.replace(projectRoot + '/', ''), storyCount: importers.size });
      for (const story of importers.keys()) all.add(story);
    }
    out.push({
      changedCssFile: css,
      siblingFiles: siblings.map((s) => s.replace(projectRoot + '/', '')),
      importingStories: [...all],
      perSibling,
    });
  }
  return out;
}

async function findStoryFiles(dir: string, acc: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (IGNORE_DIRS.has(e.name) || e.name.startsWith('.')) continue;
    const path = join(dir, e.name);
    if (e.isDirectory()) await findStoryFiles(path, acc);
    else if (STORY_RE.test(e.name)) acc.push(normalize(path));
  }
  return acc;
}

async function findSiblingsJs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!JS_RE.test(e.name)) continue;
    if (e.name.endsWith('.test.ts') || e.name.endsWith('.spec.ts')) continue;
    out.push(normalize(join(dir, e.name)));
  }
  return out;
}

export function isCssFile(path: string): boolean {
  return CSS_RE.test(path);
}
