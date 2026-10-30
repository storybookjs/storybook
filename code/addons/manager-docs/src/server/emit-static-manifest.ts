import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { dirname, join } from 'pathe';

import { STATIC_MDX_MANIFEST_FILE } from '../constants.ts';
import { ManagerDocsError } from '../errors.ts';
import type { IndexedEntry } from '../runtime/docs-page.ts';
import { buildStaticMdxManifest } from '../runtime/static-manifest.ts';

export type StaticBuildOptions = {
  outputDir?: string;
  configType?: 'DEVELOPMENT' | 'PRODUCTION';
  presets?: {
    apply: (extension: string, config?: unknown) => Promise<unknown>;
  };
};

type IndexGenerator = {
  getIndex: () => Promise<{ entries: Record<string, IndexedEntry> }>;
};

export async function emitStaticMdxDuringBuild(
  options: StaticBuildOptions,
  projectRoot = process.cwd()
): Promise<string | undefined> {
  if (options.configType !== 'PRODUCTION' || !options.outputDir) {
    return undefined;
  }
  if (!options.presets) {
    throw new ManagerDocsError('Static MDX manifest requires presets.');
  }
  const generator = (await options.presets.apply('storyIndexGenerator')) as
    | IndexGenerator
    | undefined;
  if (!generator || typeof generator.getIndex !== 'function') {
    throw new ManagerDocsError('Static MDX manifest requires the story index.');
  }
  const index = await generator.getIndex();
  const entries = Object.values(index.entries);
  const docsFiles = entries.flatMap((entry) =>
    entry.type === 'docs' && entry.importPath?.toLowerCase().endsWith('.mdx')
      ? [entry.importPath]
      : []
  );
  const manifest = await buildStaticMdxManifest({
    projectRoot,
    docsFiles,
    entries,
    readFile: (absolutePath) => readFile(absolutePath, 'utf8'),
  });
  const target = join(options.outputDir, STATIC_MDX_MANIFEST_FILE);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(manifest));
  return target;
}
