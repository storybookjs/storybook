import { logger } from 'storybook/internal/node-logger';
import type { DocgenProvider, PresetPropertyFn } from 'storybook/internal/types';

import { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import type { TypescriptOptions } from '../componentManifest/getComponentImports.ts';
import { buildDocgenPayload } from './buildDocgen.ts';

/**
 * Module-scoped {@link ComponentMetaManager} singleton. Created lazily on the first docgen call
 * and reused for the lifetime of the process so the file-snapshot cache and any future TS programs
 * stay hot across multiple per-component extractions. Returns `undefined` if TypeScript is not
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
 * Wraps the previously accumulated provider (received as the preset `config`), calls
 * `nextDocgen?.(input)` to get the downstream payload (typically an empty seed from core), and
 * replaces / fills in the component-level fields using the React Component Meta extractor.
 * Fields the downstream chain set are preserved when this provider has nothing better.
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
    const downstream = await nextDocgen?.(input);
    const manager = await getManager();

    if (!manager) {
      // TypeScript missing — return the downstream payload unchanged (or a minimal fallback).
      return (
        downstream ?? {
          componentId: input.componentId,
          name: input.componentId,
          description: '',
          props: [],
        }
      );
    }

    const ours = await buildDocgenPayload(input, { manager, typescriptOptions });

    // Merge strategy: our component-level fields win when present; downstream fields fill gaps.
    return {
      componentId: input.componentId,
      name: ours.name || downstream?.name || input.componentId,
      description: ours.description || downstream?.description || '',
      summary: ours.summary ?? downstream?.summary,
      jsDocTags: ours.jsDocTags ?? downstream?.jsDocTags,
      props: ours.props.length > 0 ? ours.props : (downstream?.props ?? []),
      subcomponents: ours.subcomponents ?? downstream?.subcomponents,
      stories: ours.stories ?? downstream?.stories,
      error: ours.error ?? downstream?.error,
    };
  };

  return wrapped;
};
