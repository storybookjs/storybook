import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const DOCS_TOOLSET_DIR = import.meta.dirname;
const CORE_SRC = resolve(DOCS_TOOLSET_DIR, '../../../..');

/** Entry points that must stay runtime-agnostic so every consumer can compose them. */
const ENTRY_POINTS = ['definition.ts', 'access.ts', 'access-service.ts', 'access-manifest.ts'];

const IMPORT_RE = /^\s*(?:import|export)\s(?:[\s\S]*?)from\s+['"]([^'"]+)['"]/gm;
const TYPE_ONLY_RE = /^\s*(?:import|export)\s+type\s/;

function importsOf(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf-8');
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    // Type-only imports are erased, so they cannot drag a runtime dependency into a bundle.
    if (TYPE_ONLY_RE.test(match[0])) {
      continue;
    }
    specifiers.push(match[1]);
  }
  return specifiers;
}

function walk(entry: string): Map<string, string[]> {
  const reached = new Map<string, string[]>();
  const queue: Array<{ file: string; trail: string[] }> = [{ file: entry, trail: [] }];

  while (queue.length > 0) {
    const { file, trail } = queue.shift()!;
    if (reached.has(file)) {
      continue;
    }
    reached.set(file, trail);

    for (const specifier of importsOf(file)) {
      if (!specifier.startsWith('.')) {
        reached.set(specifier, [...trail, relative(CORE_SRC, file)]);
        continue;
      }
      const target = join(dirname(file), specifier);
      // Relative imports in this repo always carry their extension, so anything else is a match
      // from prose rather than a real import.
      if (!existsSync(target)) {
        continue;
      }
      queue.push({ file: target, trail: [...trail, relative(CORE_SRC, file)] });
    }
  }

  return reached;
}

/**
 * The docs toolset is composed by the dev server, by the hosted MCP server, and (from Milestone 5)
 * by the CLI. Everything environment-specific has to stay behind the injected `DocsAccess`, so a
 * dependency on core-server would silently make the toolset dev-server-only again.
 */
describe('docs toolset stays runtime-agnostic', () => {
  it.each(ENTRY_POINTS)('%s never reaches core-server', (entryPoint) => {
    const reached = walk(join(DOCS_TOOLSET_DIR, entryPoint));

    const offenders = [...reached.entries()].filter(
      ([target]) =>
        target.includes('storybook/internal/core-server') || target.includes('core-server/')
    );

    expect(
      offenders.map(([target, trail]) => `${target} (via ${trail.join(' -> ') || 'direct'})`)
    ).toEqual([]);
  });
});
