import type { ModuleGraphService } from '../module-graph/definition.ts';

export type DetectUnreachableFilesOptions = {
  files: string[];
  moduleGraph: ModuleGraphService;
};

export async function detectUnreachableFiles({
  files,
  moduleGraph,
}: DetectUnreachableFilesOptions): Promise<string[]> {
  const status = await moduleGraph.queries.status.loaded(undefined);
  if (status.value !== 'ready') {
    return [];
  }

  const storiesForFiles = await moduleGraph.queries.storiesForFiles.loaded({ files });
  return files.filter((_file, index) => storiesForFiles[index]?.length === 0);
}
