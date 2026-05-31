import { afterEach, describe, expect, it, vi } from 'vitest';

import { join, normalize } from 'pathe';

import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { clearRegistry } from '../../server.ts';
import { connectDocgenToModuleGraph, registerDocgenService } from './server.ts';
import type { DocgenProvider } from './types.ts';
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
 * Sets up the same wiring the `services` preset does: register both services and connect docgen to
 * the module graph via the open-service subscription. The change detector is simulated by calling
 * the module graph's `resolveAffectedComponents` command directly (in production the dev server
 * does this on file-change events).
 */
function setup(provider: DocgenProvider) {
  const entries = [makeStoryEntry('button--primary', 'button')];
  const moduleGraph = registerModuleGraphService({
    getIndex: makeGetIndex(entries),
    workingDir: WORKING_DIR,
  });
  const docgen = registerDocgenService({ getIndex: makeGetIndex(entries), provider });
  const unsubscribe = connectDocgenToModuleGraph(docgen, moduleGraph);
  return { moduleGraph, docgen, unsubscribe };
}

describe('docgen invalidation (server-side, open-service native wiring)', () => {
  it('re-extracts and notifies subscribers when the module graph reports a change', async () => {
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

    const { moduleGraph, docgen, unsubscribe } = setup(provider);

    // User navigates to the component: docgen is extracted and cached ("present").
    await docgen.queries.getDocgen.loaded({ componentId: 'button' });
    expect(docgen.queries.getDocgen({ componentId: 'button' })).toMatchObject({
      description: 'v1',
    });

    const emitted: Array<{ description: string } | undefined> = [];
    const unsubDocgen = docgen.queries.getDocgen.subscribe({ componentId: 'button' }, (value) => {
      emitted.push(value as { description: string } | undefined);
    });
    await vi.waitFor(() => expect(emitted.at(-1)).toMatchObject({ description: 'v1' }));

    // The component's source changes; the change detector feeds the module graph. No explicit
    // docgen call here — docgen reacts through its subscription to the module graph.
    descriptionByImportPath['./button.stories.tsx'] = 'v2';
    await moduleGraph.commands.resolveAffectedComponents({ storyFiles: [absStoryFile('button')] });

    // Future reads are fresh (no stale data) and the live subscriber was notified (no flash).
    await vi.waitFor(() =>
      expect(docgen.queries.getDocgen({ componentId: 'button' })).toMatchObject({
        description: 'v2',
      })
    );
    await vi.waitFor(() => expect(emitted.at(-1)).toMatchObject({ description: 'v2' }));

    unsubDocgen();
    unsubscribe();
  });

  it('does not extract components that were never viewed (re-extract-if-present)', async () => {
    const provider = vi.fn<DocgenProvider>(async () => ({
      componentId: 'button',
      name: 'Button',
      description: 'x',
      props: [],
    }));

    const { moduleGraph, unsubscribe } = setup(provider);

    await moduleGraph.commands.resolveAffectedComponents({ storyFiles: [absStoryFile('button')] });
    // Let the docgen subscription run handleSourceChange.
    await vi.waitFor(() =>
      expect(moduleGraph.queries.getLastAffected({}).componentIds).toEqual(['button'])
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Never extracted -> absent -> provider must not have been invoked by the invalidation.
    expect(provider).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('re-emits on repeated changes to the same component (revision defeats value-dedup)', async () => {
    let version = 1;
    const provider: DocgenProvider = async () => ({
      componentId: 'button',
      name: 'Button',
      description: `v${version}`,
      props: [],
    });

    const { moduleGraph, docgen, unsubscribe } = setup(provider);

    await docgen.queries.getDocgen.loaded({ componentId: 'button' });

    const emitted: string[] = [];
    const unsubDocgen = docgen.queries.getDocgen.subscribe({ componentId: 'button' }, (value) => {
      emitted.push((value as { description: string }).description);
    });
    await vi.waitFor(() => expect(emitted.at(-1)).toBe('v1'));

    version = 2;
    await moduleGraph.commands.resolveAffectedComponents({ storyFiles: [absStoryFile('button')] });
    await vi.waitFor(() => expect(emitted.at(-1)).toBe('v2'));

    version = 3;
    await moduleGraph.commands.resolveAffectedComponents({ storyFiles: [absStoryFile('button')] });
    await vi.waitFor(() => expect(emitted.at(-1)).toBe('v3'));

    unsubDocgen();
    unsubscribe();
  });
});
