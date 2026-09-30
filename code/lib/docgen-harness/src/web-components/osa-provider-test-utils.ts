import type { DocgenProvider, IndexEntry } from 'storybook/internal/types';
import { toId } from 'storybook/internal/csf';
import { loadCsf } from 'storybook/internal/csf-tools';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { vi } from 'vitest';

import {
  createDocgenProvider,
  DEFAULT_TYPE_PROPERTY,
} from '../../../../renderers/web-components/src/docgen/index.ts';

export function entryForFixture(fixtureCase: string, testDir: string): IndexEntry {
  const source = readFileSync(join(testDir, 'input.stories.ts'), 'utf8');
  const csf = loadCsf(source, { makeTitle: (title) => title }).parse();
  const [firstExport] = Object.keys(csf._stories);
  if (!csf._meta?.title || !firstExport) {
    throw new Error(`${fixtureCase}: input.stories.ts must declare a title and at least one story`);
  }
  return {
    id: toId(fixtureCase, firstExport),
    name: firstExport,
    title: csf._meta.title,
    type: 'story',
    subtype: 'story',
    importPath: './input.stories.ts',
  };
}

export function runProvider(
  testDir: string,
  entry: IndexEntry,
  manifestPath: string
): ReturnType<DocgenProvider> {
  vi.spyOn(process, 'cwd').mockReturnValue(testDir);
  const provider = createDocgenProvider({
    manifestPaths: [manifestPath],
    typeProperty: DEFAULT_TYPE_PROPERTY,
  })(async () => undefined);
  return provider({ entry });
}
