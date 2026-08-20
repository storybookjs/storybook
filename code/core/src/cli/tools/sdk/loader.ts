import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { CreateToolsOptions, LocalTools, Tools } from './types.ts';

const TOOLS_ENTRY = 'storybook/internal/tools';

type CreateTools = (options?: CreateToolsOptions) => Promise<Tools>;

/**
 * Create a tools host with the SDK the target project installed, never this process's own copy.
 *
 * Toolset code has to run against the Storybook a project depends on, so this resolves
 * `storybook/internal/tools` from `projectDir`, imports that copy, and forwards the options to its
 * `createTools`, with `cwd` defaulting to `projectDir`. Nothing else in the SDK is loaded here,
 * which keeps this entry stable for embedders that bundle their own `storybook`.
 *
 * @throws {Error} When the project has no resolvable `storybook/internal/tools`, or when that entry
 *   exposes no `createTools`.
 */
export function loadTools(
  projectDir: string,
  options: CreateToolsOptions & { mode: 'local' }
): Promise<LocalTools>;
export function loadTools(projectDir: string, options?: CreateToolsOptions): Promise<Tools>;
export async function loadTools(
  projectDir: string,
  options: CreateToolsOptions = {}
): Promise<Tools> {
  const entryPath = resolveToolsEntry(projectDir);
  const namespace: unknown = await import(pathToFileURL(entryPath).href);
  return selectCreateTools(namespace, entryPath)({ cwd: projectDir, ...options });
}

function resolveToolsEntry(projectDir: string): string {
  // Issued from the project rather than from this file: this loader ships inside `storybook`, and
  // Node's self-reference resolution would hand back its own package's entry before reading `paths`.
  const projectRequire = createRequire(join(projectDir, 'package.json'));
  try {
    return projectRequire.resolve(TOOLS_ENTRY, { paths: [projectDir] });
  } catch (cause) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors -- the shim imports no taxonomy
    throw new Error(
      `Could not resolve \`${TOOLS_ENTRY}\` from ${projectDir}. Install Storybook in that project, then retry.`,
      { cause }
    );
  }
}

function selectCreateTools(namespace: unknown, entryPath: string): CreateTools {
  const candidates = [namespace, (namespace as { default?: unknown } | undefined)?.default];
  for (const candidate of candidates) {
    const createTools = (candidate as { createTools?: unknown } | undefined)?.createTools;
    if (typeof createTools === 'function') {
      return createTools as CreateTools;
    }
  }
  // eslint-disable-next-line local-rules/no-uncategorized-errors -- the shim imports no taxonomy
  throw new Error(`The \`${TOOLS_ENTRY}\` entry at ${entryPath} exposes no \`createTools\`.`);
}
