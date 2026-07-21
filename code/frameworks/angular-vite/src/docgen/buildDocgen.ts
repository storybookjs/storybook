import { getStoryImportPathFromEntry } from 'storybook/internal/common';
import type { DocgenPayload, DocgenProviderInput } from 'storybook/internal/types';

import path from 'pathe';

import { buildComponentDocgenFromResolved } from '../componentManifest/buildAngularComponentDocgen.ts';
import { getCompodocDocumentation } from '../componentManifest/compodocExtractor.ts';
import { resolveAngularStoryComponent } from '../componentManifest/resolveAngularComponents.ts';

export interface BuildDocgenContext {
  /** Working directory the Compodoc `documentation.json` is resolved from. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Resolve a CSF import path to an absolute file path. Defaults to joining `cwd` with the import path. */
  resolvePath?: (importPath: string) => string;
}

/**
 * Build a {@link DocgenPayload} for the component found in one CSF story file.
 *
 * Resolves the story's primary component via {@link resolveAngularStoryComponent}, looks it up in
 * the project's Compodoc `documentation.json`, then shapes the result with
 * {@link buildComponentDocgenFromResolved}.
 *
 * Returns `undefined` when the story file cannot be read or parsed — the docgen-service provider
 * chain treats undefined as "no docgen here, fall through to the next provider". Resolution errors
 * (no `meta.component`, component missing from Compodoc output) are returned as a payload.
 */
export async function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext = {}
): Promise<DocgenPayload | undefined> {
  const storyFilePath = getStoryImportPathFromEntry(input.entry);
  if (!storyFilePath) {
    return undefined;
  }

  const cwd = context.cwd ?? process.cwd();
  const resolvePath = context.resolvePath ?? ((importPath: string) => path.join(cwd, importPath));
  const storyPath = resolvePath(storyFilePath);

  let resolved;
  try {
    resolved = await resolveAngularStoryComponent({ storyPath, title: input.entry.title });
  } catch {
    return undefined;
  }

  const { csf, componentName, storyFile } = resolved;
  const compodocJson = getCompodocDocumentation({ cwd });

  return buildComponentDocgenFromResolved({
    entry: input.entry,
    storyFilePath,
    storyFile,
    csf,
    componentName,
    compodocJson,
  });
}
