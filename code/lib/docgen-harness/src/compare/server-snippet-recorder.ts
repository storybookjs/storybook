import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from 'vitest';

import type { Framework } from './types.ts';

import { expectCurrentOrBetter } from './expect-current-or-better.ts';

const NO_SNIPPET_PREFIX = '(no snippet:';
export const NO_SNIPPET_SENTINEL = `${NO_SNIPPET_PREFIX} the Code panel falls back to the story source)`;
const STYLE_BLOCK_REGEXP = /^<style>[\s\S]*?<\/style>\n/;

const readCommitted = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined;

export async function recordServerSnippet({
  testDir,
  framework,
  prefix,
  legacyPrefix = 'snippet-',
  exportName,
  snippet,
  recorded,
  legacyParity,
  declaredOmissions,
}: {
  testDir: string;
  framework: Framework;
  prefix: string;
  legacyPrefix?: string;
  exportName: string;
  snippet: string | undefined;
  recorded: string;
  legacyParity: boolean;
  declaredOmissions?: readonly string[];
}): Promise<void> {
  const comparable = (text: string): string =>
    framework === 'web-components' ? text.replace(STYLE_BLOCK_REGEXP, '') : text;
  const snippetPath = join(testDir, `${prefix}${exportName}.snapshot`);
  const committedSnippet = readCommitted(snippetPath);

  if (
    committedSnippet !== undefined &&
    snippet !== undefined &&
    !committedSnippet.startsWith(NO_SNIPPET_PREFIX)
  ) {
    expectCurrentOrBetter({
      kind: 'snippet',
      framework,
      baseline: comparable(committedSnippet),
      candidate: comparable(snippet),
    });
  }

  if (legacyParity) {
    expect(snippet, `${exportName} lost its static snippet`).toBeDefined();
    if (snippet === undefined) {
      return;
    }
    const legacyPath = join(testDir, `${legacyPrefix}${exportName}.snapshot`);
    const committedLegacySnippet = readCommitted(legacyPath);
    expect(committedLegacySnippet, `missing legacy ${legacyPath}`).toBeDefined();
    if (committedLegacySnippet === undefined) {
      return;
    }
    expectCurrentOrBetter({
      kind: 'snippet',
      framework,
      baseline: comparable(committedLegacySnippet),
      candidate: comparable(snippet),
      declaredOmissions,
    });
  }

  await expect(recorded).toMatchFileSnapshot(snippetPath);
}

export function expectNoStaleSnippets(
  testDir: string,
  prefix: string,
  exportNames: string[]
): void {
  const onDisk = readdirSync(testDir)
    .filter((file) => file.startsWith(prefix) && file.endsWith('.snapshot'))
    .sort();
  if (onDisk.length === 0) {
    return;
  }
  const expected = exportNames.map((exportName) => `${prefix}${exportName}.snapshot`).sort();
  expect(onDisk).toEqual(expected);
}
