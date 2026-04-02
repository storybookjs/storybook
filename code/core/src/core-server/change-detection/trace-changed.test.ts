import { describe, expect, it } from 'vitest';

import type { ModuleGraph, ModuleNode } from 'storybook/internal/types';

import { findAffectedStoryFiles } from './trace-changed.ts';

function createModuleNode(file: string): ModuleNode {
  return {
    file,
    type: 'js',
    importers: new Set(),
    importedModules: new Set(),
  };
}

function createStoryIdsByFile(...files: string[]): Map<string, Set<string>> {
  return new Map(files.map((file) => [file, new Set([file])]));
}

describe('findAffectedStoryFiles', () => {
  it('returns every reachable story file with its shortest distance', () => {
    const buttonCss = createModuleNode('/repo/src/Button.module.css');
    const button = createModuleNode('/repo/src/Button.tsx');
    const header = createModuleNode('/repo/src/Header.tsx');
    const buttonStory = createModuleNode('/repo/src/Button.stories.tsx');
    const headerStory = createModuleNode('/repo/src/Header.stories.tsx');
    const page = createModuleNode('/repo/src/Page.tsx');
    const pageStory = createModuleNode('/repo/src/Page.stories.tsx');

    buttonCss.importers.add(button);
    button.importers.add(buttonStory);
    button.importers.add(header);
    header.importers.add(headerStory);
    header.importers.add(page);
    page.importers.add(pageStory);

    const moduleGraph: ModuleGraph = new Map([
      ['/repo/src/Button.module.css', new Set([buttonCss])],
      ['/repo/src/Button.tsx', new Set([button])],
      ['/repo/src/Header.tsx', new Set([header])],
      ['/repo/src/Button.stories.tsx', new Set([buttonStory])],
      ['/repo/src/Header.stories.tsx', new Set([headerStory])],
      ['/repo/src/Page.tsx', new Set([page])],
      ['/repo/src/Page.stories.tsx', new Set([pageStory])],
    ]);

    expect(
      findAffectedStoryFiles(
        '/repo/src/Button.module.css',
        moduleGraph,
        createStoryIdsByFile(
          '/repo/src/Button.stories.tsx',
          '/repo/src/Header.stories.tsx',
          '/repo/src/Page.stories.tsx'
        )
      )
    ).toEqual(
      new Map([
        ['/repo/src/Button.stories.tsx', { distance: 2 }],
        ['/repo/src/Header.stories.tsx', { distance: 3 }],
        ['/repo/src/Page.stories.tsx', { distance: 4 }],
      ])
    );
  });

  it('keeps the shortest distance when the same story file is reachable multiple ways', () => {
    const shared = createModuleNode('/repo/src/shared.ts');
    const a = createModuleNode('/repo/src/A.tsx');
    const b = createModuleNode('/repo/src/B.tsx');
    const storyViaA = createModuleNode('/repo/src/Shared.stories.tsx');
    const storyViaB = createModuleNode('/repo/src/Shared.stories.tsx');

    shared.importers.add(a);
    shared.importers.add(b);
    a.importers.add(storyViaA);
    b.importers.add(a);
    b.importers.add(storyViaB);

    const moduleGraph: ModuleGraph = new Map([
      ['/repo/src/shared.ts', new Set([shared])],
      ['/repo/src/A.tsx', new Set([a])],
      ['/repo/src/B.tsx', new Set([b])],
      ['/repo/src/Shared.stories.tsx', new Set([storyViaA, storyViaB])],
    ]);

    expect(
      findAffectedStoryFiles(
        '/repo/src/shared.ts',
        moduleGraph,
        createStoryIdsByFile('/repo/src/Shared.stories.tsx')
      )
    ).toEqual(new Map([['/repo/src/Shared.stories.tsx', { distance: 2 }]]));
  });

  it('handles cycles without looping forever', () => {
    const changed = createModuleNode('/repo/src/changed.ts');
    const a = createModuleNode('/repo/src/A.ts');
    const b = createModuleNode('/repo/src/B.ts');
    const story = createModuleNode('/repo/src/Cycle.stories.tsx');

    changed.importers.add(a);
    a.importers.add(b);
    b.importers.add(a);
    b.importers.add(story);

    const moduleGraph: ModuleGraph = new Map([
      ['/repo/src/changed.ts', new Set([changed])],
      ['/repo/src/A.ts', new Set([a])],
      ['/repo/src/B.ts', new Set([b])],
      ['/repo/src/Cycle.stories.tsx', new Set([story])],
    ]);

    expect(
      findAffectedStoryFiles(
        '/repo/src/changed.ts',
        moduleGraph,
        createStoryIdsByFile('/repo/src/Cycle.stories.tsx')
      )
    ).toEqual(new Map([['/repo/src/Cycle.stories.tsx', { distance: 3 }]]));
  });

  it('returns the changed story file with distance zero', () => {
    expect(
      findAffectedStoryFiles(
        '/repo/src/Button.stories.tsx',
        new Map(),
        createStoryIdsByFile('/repo/src/Button.stories.tsx')
      )
    ).toEqual(new Map([['/repo/src/Button.stories.tsx', { distance: 0 }]]));
  });

  it('returns an empty map when no story files are reachable', () => {
    const changed = createModuleNode('/repo/src/changed.ts');
    const component = createModuleNode('/repo/src/Component.tsx');

    changed.importers.add(component);

    const moduleGraph: ModuleGraph = new Map([
      ['/repo/src/changed.ts', new Set([changed])],
      ['/repo/src/Component.tsx', new Set([component])],
    ]);

    expect(
      findAffectedStoryFiles(
        '/repo/src/changed.ts',
        moduleGraph,
        createStoryIdsByFile('/repo/src/Button.stories.tsx')
      )
    ).toEqual(new Map());
  });
});
