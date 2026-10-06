import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';
import type { IndexEntry } from 'storybook/internal/types';
import ts from 'typescript';

import { ComponentMetaManager } from '../../../../renderers/react/src/componentManifest/componentMeta/ComponentMetaManager.ts';
import { buildDocgenPayload } from '../../../../renderers/react/src/docgen/buildDocgen.ts';
import { recordArgTypesSnapshot } from '../compare/record-argtypes-snapshot.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

// Mirrors the entry shape the manifest generator hands the docgen provider.
function makeStoryIndexEntry(importPath: string, title: string): IndexEntry {
  const componentId = title.split('/').at(-1)!.replace(/\s+/g, '').toLowerCase();
  return {
    id: `${componentId}--primary`,
    name: 'Primary',
    title,
    type: 'story',
    subtype: 'story',
    importPath,
  };
}

let componentMetaManager: ComponentMetaManager | undefined;

afterEach(() => {
  componentMetaManager?.dispose();
  componentMetaManager = undefined;
});

// First React fixture suite: drives the production OSA docgen provider (buildDocgenPayload,
// the same recipe as the react renderer's buildDocgen tests) and records argTypes baselines
// through the shared snapshot mechanism.
describe('react docgen-server baselines', () => {
  it.each(fixtureCases)('%s', { timeout: 30_000 }, async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const storyFiles = readdirSync(testDir).filter((file) => file.endsWith('.stories.tsx'));
    expect(storyFiles).toHaveLength(1);

    componentMetaManager = new ComponentMetaManager(ts);
    const payload = await buildDocgenPayload(
      { entry: makeStoryIndexEntry(join(testDir, storyFiles[0]), `React/${fixtureCase}`) },
      {
        componentMetaManager,
        resolvePath: (p) => (p.startsWith(testDir) ? p : join(testDir, p)),
      }
    );

    expect(payload).toBeDefined();
    const argTypes = payload!.argTypes;
    expect(argTypes).toBeDefined();

    await recordArgTypesSnapshot({
      path: join(testDir, 'argtypes.snapshot'),
      label: `${fixtureCase}/argtypes.snapshot`,
      candidate: argTypes!,
    });
  });
});
