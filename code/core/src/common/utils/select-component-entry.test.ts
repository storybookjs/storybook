import { describe, expect, it } from 'vitest';

import { Tag } from '../../shared/constants/tags.ts';
import type { DocsIndexEntry, IndexEntry } from '../../types/modules/indexer.ts';

import {
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
} from './select-component-entry.ts';

function makeStoryEntry(id: string, title = 'Comp'): IndexEntry {
  return {
    id,
    name: 'Default',
    title,
    type: 'story',
    subtype: 'story',
    importPath: `./${title.toLowerCase()}.stories.tsx`,
  };
}

describe('selectComponentEntriesByComponentId', () => {
  it('prefers stories over attached docs for the same componentId', () => {
    const storyEntry = makeStoryEntry('comp--default', 'Comp');
    const docsEntry = {
      id: 'comp--docs',
      name: 'Docs',
      title: 'Comp/Docs',
      type: 'docs',
      importPath: './comp.mdx',
      storiesImports: ['./wrong.stories.tsx'],
      tags: [Tag.ATTACHED_MDX, 'docs'],
    } satisfies DocsIndexEntry;

    const map = selectComponentEntriesByComponentId([docsEntry, storyEntry]);
    expect(map.get('comp')).toEqual(storyEntry);
  });

  it('falls back to attached docs when no story entry exists', () => {
    const docsEntry = {
      id: 'comp--docs',
      name: 'Docs',
      title: 'Comp/Docs',
      type: 'docs',
      importPath: './comp.mdx',
      storiesImports: ['./comp.stories.tsx'],
      tags: [Tag.ATTACHED_MDX, 'docs'],
    } satisfies DocsIndexEntry;

    const map = selectComponentEntriesByComponentId([docsEntry]);
    expect(map.get('comp')).toEqual(docsEntry);
    expect(getStoryImportPathFromEntry(docsEntry)).toBe('./comp.stories.tsx');
  });

  it('last story entry wins when multiple files share a componentId', () => {
    const first = { ...makeStoryEntry('comp--a', 'Comp'), importPath: './comp-a.stories.tsx' };
    const second = { ...makeStoryEntry('comp--b', 'Comp'), importPath: './comp-b.stories.tsx' };

    const map = selectComponentEntriesByComponentId([first, second]);
    expect(map.get('comp')).toEqual(second);
  });
});
