import type { ModuleGraph, ModuleNode } from 'storybook/internal/types';

import type { ViteDevServer, ModuleNode as ViteModuleNode } from 'vite';

export function buildModuleGraph(
  fileToModulesMap: ViteDevServer['moduleGraph']['fileToModulesMap']
): ModuleGraph {
  const moduleGraph: ModuleGraph = new Map();
  const moduleNodeMap = new WeakMap<object, ModuleNode>();

  const getOrCreateModuleNode = (
    viteModuleNode: {
      file: string | null;
      type: ViteModuleNode['type'];
      importers: Set<ViteModuleNode>;
      importedModules: Set<ViteModuleNode>;
    },
    fallbackFile?: string
  ): ModuleNode | undefined => {
    const file = viteModuleNode.file ?? fallbackFile;
    if (!file) {
      return undefined;
    }

    const existingNode = moduleNodeMap.get(viteModuleNode);
    if (existingNode) {
      return existingNode;
    }

    const moduleNode: ModuleNode = {
      file,
      type: viteModuleNode.type,
      importers: new Set(),
      importedModules: new Set(),
    };
    moduleNodeMap.set(viteModuleNode, moduleNode);

    const moduleSet = moduleGraph.get(file) ?? new Set<ModuleNode>();
    moduleSet.add(moduleNode);
    moduleGraph.set(file, moduleSet);

    return moduleNode;
  };

  fileToModulesMap.forEach((viteModuleSet, filePath) => {
    viteModuleSet.forEach((viteModuleNode) => {
      const moduleNode = getOrCreateModuleNode(viteModuleNode, filePath);
      if (moduleNode) {
        viteModuleNode.importers.forEach((importer) => {
          const importerNode = getOrCreateModuleNode(importer);
          if (importerNode) {
            moduleNode.importers.add(importerNode);
          }
        });
        viteModuleNode.importedModules.forEach((importedModule) => {
          const importedModuleNode = getOrCreateModuleNode(importedModule);
          if (importedModuleNode) {
            moduleNode.importedModules.add(importedModuleNode);
          }
        });
      }
    });
  });

  return moduleGraph;
}
