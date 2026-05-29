import { logger } from 'storybook/internal/node-logger';
import type { DocgenProvider, PresetPropertyFn } from 'storybook/internal/types';

import { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import type { TypescriptOptions } from '../componentManifest/getComponentImports.ts';
import { buildDocgenPayload } from './buildDocgen.ts';

/**
 * Module-scoped {@link ComponentMetaManager} singleton. Created lazily on the first docgen call
 * and reused for the lifetime of the process so the file-snapshot cache and any future TS programs
 * stay hot across multiple per-file extractions. Returns `undefined` if TypeScript is not
 * available in the runtime environment.
 */
let managerPromise: Promise<ComponentMetaManager | undefined> | undefined;

function getManager(): Promise<ComponentMetaManager | undefined> {
  if (!managerPromise) {
    managerPromise = (async () => {
      try {
        const ts = await import('typescript');
        return new ComponentMetaManager(ts);
      } catch {
        logger.debug('[docgen-provider] TypeScript not available — skipping RCM extraction.');
        return undefined;
      }
    })();
  }
  return managerPromise;
}

/**
 * React renderer docgen provider — phase 3: real RCM-backed extraction.
 *
 * Receives a single `importPath` from the docgen service. Bails to `nextDocgen` for non-CSF
 * paths (e.g. `.mdx` attached-docs entries) and when TypeScript isn't available. Otherwise
 * delegates to {@link buildDocgenPayload} which runs RCM against the file and returns a complete
 * {@link DocgenPayload} or `undefined` when nothing extractable is found.
 */
export const experimental_docgenProvider: PresetPropertyFn<'experimental_docgenProvider'> = async (
  nextDocgen,
  options
) => {
  // Resolve the typescript options preset once at chain-build time so the provider closure does
  // not re-read it on every call.
  const typescriptOptions =
    ((await options.presets?.apply<Partial<TypescriptOptions>>('typescript', {})) as
      | Partial<TypescriptOptions>
      | undefined) ?? {};

  const wrapped: DocgenProvider = async (input) => {
    if (!/\.stories\.[cm]?[jt]sx?$/.test(input.importPath)) {
      return nextDocgen?.(input);
    }

    const manager = await getManager();
    if (!manager) {
      return nextDocgen?.(input);
    }

    const ours = await buildDocgenPayload(input, { manager, typescriptOptions });
    if (ours) {
      return ours;
    }

    return nextDocgen?.(input);
  };

  return wrapped;
};
