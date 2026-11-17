import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { analyze, createSourceOptions, type ComponentDeclarationJson } from 'svelte-docinfo';
import { preprocess } from 'svelte/compiler';

export const createDocinfoCache = () => new Map<string, Promise<ComponentDeclarationJson>>();

export async function analyzeComponent(
  id: string,
  cache: ReturnType<typeof createDocinfoCache>
): Promise<ComponentDeclarationJson> {
  const cached = cache.get(id);
  if (cached) return cached;
  const result = (async () => {
    const source = await readFile(id, 'utf8');
    const processed = await preprocess(source, { style: () => ({ code: '' }) });
    const analysis = await analyze({
      sourceFiles: [{ id, content: processed.code }],
      sourceOptions: createSourceOptions(dirname(id), { sourcePaths: ['.'], exclude: [] }),
      tsconfig: false,
    });
    const component = analysis.modules
      .flatMap((module) => module.declarations)
      .find((declaration) => declaration.kind === 'component');
    if (!component) {
      throw new Error(
        analysis.diagnostics.map((diagnostic) => diagnostic.message).join('\n') ||
          `No component metadata for ${id}`
      );
    }
    return component;
  })();
  cache.set(id, result);
  try {
    return await result;
  } finally {
    cache.delete(id);
  }
}
