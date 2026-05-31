import { afterEach, describe, expect, it, vi } from 'vitest';

import { join, normalize } from 'pathe';

import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { clearRegistry, getService } from '../../server.ts';
import type { docgenServiceDef } from './definition.ts';
import { registerDocgenService } from './server.ts';
import type { DocgenProvider } from './types.ts';
import type { moduleGraphServiceDef } from '../module-graph/definition.ts';
import { registerModuleGraphService } from '../module-graph/server.ts';

afterEach(() => {
  clearRegistry();
});

const WORKING_DIR = '/repo';

function makeStoryEntry(id: string, fileBase: string): IndexEntry {
  return {
    id,
    name: id.split('--').slice(1).join('--') || 'Default',
    title: fileBase,
    type: 'story',
    subtype: 'story',
    importPath: `./${fileBase}.stories.tsx`,
  };
}

function makeGetIndex(entries: IndexEntry[]) {
  const index: StoryIndex = {
    v: 5,
    entries: Object.fromEntries(entries.map((entry) => [entry.id, entry])),
  };
  return () => Promise.resolve(index);
}

function absStoryFile(fileBase: string): string {
  return normalize(join(WORKING_DIR, `./${fileBase}.stories.tsx`));
}

/**
 * Mirrors the dev-server glue (`onInvalidate` -> module-graph -> docgen) against the real
 * process-global registry, proving the cross-service composition works end-to-end on the server.
 */
async function invalidateDocgenForStoryFiles(affectedStoryFiles: string[]): Promise<void> {
  const moduleGraph = getService<typeof moduleGraphServiceDef>('core/module-graph');
  const docgen = getService<typeof docgenServiceDef>('core/docgen');
  const { componentIds } = await moduleGraph.commands.resolveAffectedComponents({
    storyFiles: affectedStoryFiles,
  });
  if (componentIds.length > 0) {
    await docgen.commands.handleSourceChange({ componentIds });
  }
}

describe('docgen invalidation (server-side end-to-end)', () => {
  it('re-extracts and notifies subscribers when an affected story file changes', async () => {
    // A content-sensitive provider whose output changes when the underlying source changes.
    const descriptionByImportPath: Record<string, string> = {
      './button.stories.tsx': 'v1',
    };
    const provider: DocgenProvider = async ({ importPath }) => ({
      componentId: 'button',
      name: 'Button',
      description: descriptionByImportPath[importPath] ?? 'unknown',
      props: [],
    });

    registerModuleGraphService({
      getIndex: makeGetIndex([makeStoryEntry('button--primary', 'button')]),
      workingDir: WORKING_DIR,
    });
    const docgen = registerDocgenService({
      getIndex: makeGetIndex([makeStoryEntry('button--primary', 'button')]),
      provider,
    });

    // User navigates to the component: docgen is extracted and cached.
    await docgen.queries.getDocgen.loaded({ componentId: 'button' });
    expect(docgen.queries.getDocgen({ componentId: 'button' })).toMatchObject({
      description: 'v1',
    });

    const emitted: Array<{ description: string } | undefined> = [];
    const unsubscribe = docgen.queries.getDocgen.subscribe({ componentId: 'button' }, (value) => {
      emitted.push(value as { description: string } | undefined);
    });
    await vi.waitFor(() => expect(emitted.at(-1)).toMatchObject({ description: 'v1' }));

    // The component's source changes on disk.
    descriptionByImportPath['./button.stories.tsx'] = 'v2';
    await invalidateDocgenForStoryFiles([absStoryFile('button')]);

    // Future reads are fresh (no stale data) and the live subscriber was notified (no flash).
    expect(docgen.queries.getDocgen({ componentId: 'button' })).toMatchObject({
      description: 'v2',
    });
    await vi.waitFor(() => expect(emitted.at(-1)).toMatchObject({ description: 'v2' }));

    unsubscribe();
  });

  it('does not extract components that were never viewed (re-extract-if-present)', async () => {
    const provider = vi.fn<DocgenProvider>(async () => ({
      componentId: 'button',
      name: 'Button',
      description: 'x',
      props: [],
    }));

    registerModuleGraphService({
      getIndex: makeGetIndex([makeStoryEntry('button--primary', 'button')]),
      workingDir: WORKING_DIR,
    });
    registerDocgenService({
      getIndex: makeGetIndex([makeStoryEntry('button--primary', 'button')]),
      provider,
    });

    await invalidateDocgenForStoryFiles([absStoryFile('button')]);

    expect(provider).not.toHaveBeenCalled();
    expect(
      getService<typeof docgenServiceDef>('core/docgen').queries.getDocgen({
        componentId: 'button',
      })
    ).toBeUndefined();
  });
});
