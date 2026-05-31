import { afterEach, describe, expect, it } from 'vitest';

import { join, normalize } from 'pathe';

import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { clearRegistry } from '../../server.ts';
import { registerModuleGraphService } from './server.ts';

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

function abs(fileBase: string): string {
  return normalize(join(WORKING_DIR, `./${fileBase}.stories.tsx`));
}

describe('module-graph open service', () => {
  describe('resolveAffectedComponents command', () => {
    it('maps absolute story files to distinct component ids', async () => {
      const service = registerModuleGraphService({
        getIndex: makeGetIndex([
          makeStoryEntry('button--primary', 'button'),
          makeStoryEntry('button--secondary', 'button'),
          makeStoryEntry('card--default', 'card'),
        ]),
        workingDir: WORKING_DIR,
      });

      const result = await service.commands.resolveAffectedComponents({
        storyFiles: [abs('button'), abs('card')],
      });

      expect(result.componentIds.sort()).toEqual(['button', 'card']);
      expect(result.revision).toBe(1);
    });

    it('ignores story files that do not correspond to any index entry', async () => {
      const service = registerModuleGraphService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'button')]),
        workingDir: WORKING_DIR,
      });

      const result = await service.commands.resolveAffectedComponents({
        storyFiles: [abs('does-not-exist')],
      });

      expect(result.componentIds).toEqual([]);
    });

    it('records the latest invalidation in state and bumps the revision', async () => {
      const service = registerModuleGraphService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'button')]),
        workingDir: WORKING_DIR,
      });

      await service.commands.resolveAffectedComponents({ storyFiles: [abs('button')] });
      const second = await service.commands.resolveAffectedComponents({ storyFiles: [] });

      expect(second.revision).toBe(2);
      expect(service.queries.getLastAffected({})).toEqual({
        revision: 2,
        componentIds: [],
      });
    });
  });
});
