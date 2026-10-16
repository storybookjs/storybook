// Snapshot gating shared by every Angular snippet recorder. Free of the client renderer, so the
// server-side recorder can use it without loading `@angular/core`.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'vitest';

import { expectCurrentOrBetter } from '../compare/expect-current-or-better.ts';
import { assertGatableAngularSnippet } from '../compare/snippets-angular.ts';

export type SnippetPrefix = 'snippet-' | 'acm-snippet-' | 'server-snippet-';

export const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

export const listFixtureCases = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

export const fixtureCases = listFixtureCases(fixturesDir);

export const readCommitted = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined;

export async function recordSnippet({
  testDir,
  prefix,
  exportName,
  snippet,
  comparable = (text) => text,
  legacyParity = false,
}: {
  testDir: string;
  prefix: SnippetPrefix;
  exportName: string;
  snippet: string;
  // Reduces a recorded snippet to the part the comparison gates read, applied to the candidate and
  // to both baselines alike. A snippet that embeds its template in a larger form records in full,
  // so the wrapper stays reviewable, while every gate keeps measuring the template it always did.
  comparable?: (text: string) => string;
  // Additionally gate the snippet against the legacy recorder's committed `snippet-` file.
  legacyParity?: boolean;
}): Promise<void> {
  const snippetPath = join(testDir, `${prefix}${exportName}.snapshot`);
  const committedSnippet = readCommitted(snippetPath);

  // Every gate runs BEFORE the snapshot call: under `-u` that call queues the rewrite, so a gate
  // placed after it would turn the run red while still persisting the regressed recording.
  assertGatableAngularSnippet(comparable(snippet));

  if (committedSnippet !== undefined) {
    expectCurrentOrBetter({
      kind: 'snippet',
      framework: 'angular',
      baseline: comparable(committedSnippet),
      candidate: comparable(snippet),
    });
  }

  if (legacyParity) {
    // Asserted to exist so deleting the legacy files can never silently disarm this gate.
    const committedLegacySnippet = readCommitted(join(testDir, `snippet-${exportName}.snapshot`));
    expect(
      committedLegacySnippet,
      `missing legacy ${join(testDir, `snippet-${exportName}.snapshot`)}`
    ).toBeDefined();
    expectCurrentOrBetter({
      kind: 'snippet',
      framework: 'angular',
      baseline: comparable(committedLegacySnippet!),
      candidate: comparable(snippet),
    });
  }

  await expect(snippet).toMatchFileSnapshot(snippetPath);
}

// toMatchFileSnapshot files sit outside vitest's obsolete-snapshot detection, so a renamed or
// removed story export would silently leave its old recording behind.
export function expectNoStaleSnippets(
  testDir: string,
  prefix: SnippetPrefix,
  exportNames: string[]
): void {
  const onDisk = readdirSync(testDir)
    .filter((file) => file.startsWith(prefix) && file.endsWith('.snapshot'))
    .sort();
  const expected = exportNames.map((exportName) => `${prefix}${exportName}.snapshot`).sort();
  expect(onDisk).toEqual(expected);
}
