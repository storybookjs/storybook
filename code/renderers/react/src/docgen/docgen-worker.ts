/**
 * Worker-target docgen module for the React renderer.
 *
 * Core's docgen worker imports this module and calls {@link createDocgenProvider} once to build the
 * middleware it folds into the provider chain. Everything here runs inside that worker thread: the
 * heavy `react-component-meta` extraction (a full TypeScript program build via
 * {@link ComponentMetaManager}) happens off the main event loop. The React renderer implements no
 * threading itself — it only describes this module to core through the `experimental_docgenProvider`
 * preset.
 *
 * This provider needs no configuration: `react-component-meta` extraction reads nothing from the
 * user's `typescript` options. `ComponentMetaManager` builds its own program, and the only
 * docgen-relevant TS option (`reactDocgenTypescriptOptions`, including `propFilter`) applies solely
 * to the `react-docgen-typescript` engine used by the legacy manifest path — not here.
 */
import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import type { DocgenMiddleware, DocgenProvider } from 'storybook/internal/types';

import { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import { buildDocgenPayload } from './buildDocgen.ts';

/**
 * Builds the React docgen middleware. Owns one {@link ComponentMetaManager} for the worker's
 * lifetime so the TypeScript language service / program stays warm across components. The manager is
 * created lazily on the first eligible request and memoized; when TypeScript is unavailable the
 * middleware passes through to the rest of the chain.
 */
export const createDocgenProvider = (): DocgenMiddleware => {
  let managerPromise: Promise<ComponentMetaManager | undefined> | undefined;

  const getManager = (): Promise<ComponentMetaManager | undefined> => {
    if (!managerPromise) {
      managerPromise = (async () => {
        try {
          const ts = await import('typescript');
          return new ComponentMetaManager(ts);
        } catch {
          return undefined;
        }
      })();
    }
    return managerPromise;
  };

  return (nextDocgen: DocgenProvider): DocgenProvider =>
    async (input) => {
      const storyImportPath = getStoryImportPathFromEntry(input.entry);
      if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
        return nextDocgen(input);
      }

      const componentMetaManager = await getManager();
      if (!componentMetaManager) {
        return nextDocgen(input);
      }

      const ours = await buildDocgenPayload(input, { componentMetaManager });
      if (!ours) {
        return nextDocgen(input);
      }

      const downstream = await nextDocgen(input);
      return { ...downstream, ...ours };
    };
};
