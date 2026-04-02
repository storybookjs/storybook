import type { ModuleGraph, ModuleNode } from 'storybook/internal/types';

export function findAffectedStoryFiles(
  changedFile: string,
  moduleGraph: ModuleGraph,
  storyIdsByFile: Map<string, Set<string>>
): Map<string, { distance: number }> {
  const affectedStoryFiles = new Map<string, { distance: number }>();

  if (storyIdsByFile.has(changedFile)) {
    affectedStoryFiles.set(changedFile, { distance: 0 });
  }

  const startingNodes = moduleGraph.get(changedFile);
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
      if (storyIdsByFile.has(importer.file)) {
        const previousStoryDistance = affectedStoryFiles.get(importer.file)?.distance;

        if (previousStoryDistance === undefined || distance < previousStoryDistance) {
          affectedStoryFiles.set(importer.file, { distance });
        }
      }

      queue.push({ node: importer, distance });
    });
  }

  return affectedStoryFiles;
}
