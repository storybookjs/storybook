import { existsSync } from 'node:fs';
import { createRequire, register } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { CreateToolsOptions, LocalTools, Tools } from './types.ts';

const TOOLS_ENTRY = 'storybook/internal/tools';
const PNP_API_FILES = ['.pnp.cjs', '.pnp.js'] as const;

type YarnPnpApi = {
  setup?: () => void;
  resolveRequest?: (
    request: string,
    issuer: string,
    opts?: { considerBuiltins?: boolean }
  ) => string | null;
};

type CreateTools = (options?: CreateToolsOptions) => Promise<Tools>;

/**
 * Create a tools host with the SDK the target project installed, never this process's own copy.
 *
 * Toolset code has to run against the Storybook a project depends on, so this resolves
 * `storybook/internal/tools` from `projectDir`, imports that copy, and forwards the options to its
 * `createTools`, with `cwd` defaulting to `projectDir`. Yarn PnP projects are resolved through the
 * target `.pnp.cjs`, not this process's Node resolver. Nothing else in the SDK is loaded here,
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
  const resolvedProjectDir = resolve(projectDir);
  const entryPath = await resolveToolsEntry(resolvedProjectDir);
  const namespace: unknown = await import(pathToFileURL(entryPath).href);
  return selectCreateTools(namespace, entryPath)({ cwd: resolvedProjectDir, ...options });
}

async function resolveToolsEntry(projectDir: string): Promise<string> {
  const pnpApiPath = findPnpApi(projectDir);
  if (pnpApiPath) {
    try {
      return await resolveThroughPnp(projectDir, pnpApiPath);
    } catch (cause) {
      throw cannotResolve(projectDir, cause);
    }
  }

  // Issued from the project rather than from this file: this loader ships inside `storybook`, and
  // Node's self-reference resolution would hand back its own package's entry before reading `paths`.
  const projectRequire = createRequire(join(projectDir, 'package.json'));
  try {
    return projectRequire.resolve(TOOLS_ENTRY, { paths: [projectDir] });
  } catch (cause) {
    throw cannotResolve(projectDir, cause);
  }
}

async function resolveThroughPnp(projectDir: string, pnpApiPath: string): Promise<string> {
  const { default: pnpApi } = (await import(pathToFileURL(pnpApiPath).href)) as {
    default: YarnPnpApi;
  };
  // `pnpapi` is only injected when Node was started via Yarn.
  pnpApi.setup?.();
  const pnpLoader = join(dirname(pnpApiPath), '.pnp.loader.mjs');
  if (existsSync(pnpLoader)) {
    register(pathToFileURL(pnpLoader).href);
  }

  const issuer = join(projectDir, 'package.json');
  const resolved = pnpApi.resolveRequest?.(TOOLS_ENTRY, issuer, { considerBuiltins: false });
  if (resolved) {
    return resolved;
  }

  return createRequire(issuer).resolve(TOOLS_ENTRY, { paths: [projectDir] });
}

function findPnpApi(projectDir: string): string | undefined {
  let current = projectDir;
  for (;;) {
    for (const name of PNP_API_FILES) {
      const candidate = join(current, name);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function cannotResolve(projectDir: string, cause: unknown): Error {
  // eslint-disable-next-line local-rules/no-uncategorized-errors -- the shim imports no taxonomy
  return new Error(
    `Could not resolve \`${TOOLS_ENTRY}\` from ${projectDir}. Install Storybook in that project, then retry.`,
    { cause }
  );
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
