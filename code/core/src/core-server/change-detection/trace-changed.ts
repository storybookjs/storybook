import type { ModuleGraph, ModuleNode } from 'storybook/internal/types';

import { normalizePath } from '../../common/utils/normalize-path.ts';

function getModuleNodesByNormalizedPath(
  moduleGraph: ModuleGraph,
  normalizedPath: string
): Set<ModuleNode> | undefined {
  const directMatch = moduleGraph.get(normalizedPath);
  if (directMatch) {
    return directMatch;
  }

  for (const [modulePath, nodes] of moduleGraph.entries()) {
    if (normalizePath(modulePath) === normalizedPath) {
      return nodes;
    }
  }

  return undefined;
}

export function findAffectedStoryFiles(
  changedFile: string,
  moduleGraph: ModuleGraph,
  storyIdsByFile: Map<string, Set<string>>
): Map<string, { distance: number }> {
  const affectedStoryFiles = new Map<string, { distance: number }>();
  const normalizedChangedFile = normalizePath(changedFile);

  if (storyIdsByFile.has(normalizedChangedFile)) {
    affectedStoryFiles.set(normalizedChangedFile, { distance: 0 });
  }

  const startingNodes = getModuleNodesByNormalizedPath(moduleGraph, normalizedChangedFile);
  if (!startingNodes?.size) {
    return affectedStoryFiles;
  }

  const visited = new Map<ModuleNode, number>();
  const queue = Array.from(startingNodes, (node) => ({ node, distance: 0 }));
  let queueIndex = 0;

  startingNodes.forEach((node) => {
    visited.set(node, 0);
  });

  while (queueIndex < queue.length) {
    const current = queue[queueIndex++];
    current.node.importers.forEach((importer) => {
      const distance = current.distance + 1;
      const previousDistance = visited.get(importer);

      if (previousDistance !== undefined && previousDistance <= distance) {
        return;
      }

      visited.set(importer, distance);
      const normalizedImporterFile = normalizePath(importer.file);
      if (storyIdsByFile.has(normalizedImporterFile)) {
        const previousStoryDistance = affectedStoryFiles.get(normalizedImporterFile)?.distance;

        if (previousStoryDistance === undefined || distance < previousStoryDistance) {
          affectedStoryFiles.set(normalizedImporterFile, { distance });
        }
      }

      queue.push({ node: importer, distance });
    });
  }

  return affectedStoryFiles;
}
