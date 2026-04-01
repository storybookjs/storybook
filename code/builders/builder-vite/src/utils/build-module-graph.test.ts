import { describe, expect, it, vi } from 'vitest';

import type { ModuleNode as StorybookModuleNode } from 'storybook/internal/types';
import type { ViteDevServer } from 'vite';

import { buildModuleGraph } from './build-module-graph.ts';

vi.mock('./vite-server', () => ({
  createViteServer: vi.fn(),
}));

type ViteModuleNodeLike = {
  file: string | null;
  type: StorybookModuleNode['type'];
  importers: Set<ViteModuleNodeLike>;
  importedModules: Set<ViteModuleNodeLike>;
};

function createViteModuleNode(
  file: string | null,
  type: StorybookModuleNode['type'] = 'js'
): ViteModuleNodeLike {
  return {
    file,
    type,
    importers: new Set(),
    importedModules: new Set(),
  };
}

function createFileToModulesMap(...entries: Array<[string, Set<ViteModuleNodeLike>]>) {
  return new Map(entries) as ViteDevServer['moduleGraph']['fileToModulesMap'];
}

function getFirstNode(
  file: string,
  moduleGraph: ReturnType<typeof buildModuleGraph>
): StorybookModuleNode {
  const moduleNode = moduleGraph.get(file)?.values().next().value;
  if (!moduleNode) {
    throw new Error(`Expected module node for ${file}`);
  }
  return moduleNode;
}

describe('buildModuleGraph', () => {
  it('converts vite module nodes into the shared module graph shape', () => {
    const entry = createViteModuleNode('/src/entry.ts');
    const component = createViteModuleNode('/src/component.ts');
    const styles = createViteModuleNode('/src/component.css', 'css');

    entry.importedModules.add(component);
    component.importers.add(entry);
    component.importedModules.add(styles);
    styles.importers.add(component);

    const moduleGraph = buildModuleGraph(
      createFileToModulesMap(
        ['/src/entry.ts', new Set([entry])],
        ['/src/component.ts', new Set([component])],
        ['/src/component.css', new Set([styles])]
      )
    );

    const entryNode = getFirstNode('/src/entry.ts', moduleGraph);
    const componentNode = getFirstNode('/src/component.ts', moduleGraph);
    const styleNode = getFirstNode('/src/component.css', moduleGraph);

    expect(entryNode.file).toBe('/src/entry.ts');
    expect(componentNode.type).toBe('js');
    expect(styleNode.type).toBe('css');

    expect(entryNode.importedModules).toEqual(new Set([componentNode]));
    expect(componentNode.importers).toEqual(new Set([entryNode]));
    expect(componentNode.importedModules).toEqual(new Set([styleNode]));
    expect(styleNode.importers).toEqual(new Set([componentNode]));
  });

  it('reuses the same converted node identity across relationships', () => {
    const shared = createViteModuleNode('/src/shared.ts');
    const importerA = createViteModuleNode('/src/a.ts');
    const importerB = createViteModuleNode('/src/b.ts');

    importerA.importedModules.add(shared);
    importerB.importedModules.add(shared);
    shared.importers.add(importerA);
    shared.importers.add(importerB);

    const moduleGraph = buildModuleGraph(
      createFileToModulesMap(
        ['/src/shared.ts', new Set([shared])],
        ['/src/a.ts', new Set([importerA])],
        ['/src/b.ts', new Set([importerB])]
      )
    );

    const sharedNode = getFirstNode('/src/shared.ts', moduleGraph);
    const importerANode = getFirstNode('/src/a.ts', moduleGraph);
    const importerBNode = getFirstNode('/src/b.ts', moduleGraph);

    expect(importerANode.importedModules.has(sharedNode)).toBe(true);
    expect(importerBNode.importedModules.has(sharedNode)).toBe(true);
    expect(sharedNode.importers).toEqual(new Set([importerANode, importerBNode]));
  });

  it('skips related vite module nodes without a file', () => {
    const entry = createViteModuleNode('/src/entry.ts');
    const virtualModule = createViteModuleNode(null);

    entry.importedModules.add(virtualModule);
    virtualModule.importers.add(entry);

    const moduleGraph = buildModuleGraph(
      createFileToModulesMap(['/src/entry.ts', new Set([entry])])
    );
    const entryNode = getFirstNode('/src/entry.ts', moduleGraph);

    expect(moduleGraph.size).toBe(1);
    expect(entryNode.importedModules.size).toBe(0);
  });

  it('preserves edges for related vite module nodes discovered before their file path is known', () => {
    const entry = createViteModuleNode('/src/entry.ts');
    const component = createViteModuleNode(null);

    entry.importedModules.add(component);
    component.importers.add(entry);

    const moduleGraph = buildModuleGraph(
      createFileToModulesMap(
        ['/src/entry.ts', new Set([entry])],
        ['/src/component.ts', new Set([component])]
      )
    );

    const entryNode = getFirstNode('/src/entry.ts', moduleGraph);
    const componentNode = getFirstNode('/src/component.ts', moduleGraph);

    expect(entryNode.importedModules).toEqual(new Set([componentNode]));
    expect(componentNode.importers).toEqual(new Set([entryNode]));
  });

  it('keeps multiple module identities for the same file', () => {
    const clientModule = createViteModuleNode('/src/shared.ts');
    const ssrModule = createViteModuleNode('/src/shared.ts');

    const moduleGraph = buildModuleGraph(
      createFileToModulesMap(['/src/shared.ts', new Set([clientModule, ssrModule])])
    );

    expect(moduleGraph.get('/src/shared.ts')?.size).toBe(2);
  });
});
