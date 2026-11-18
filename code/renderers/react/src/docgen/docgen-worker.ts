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
 * The only `typescript` option this provider reads is `docgenSpecifier`, the package it loads
 * TypeScript from. `ComponentMetaManager` builds its own program, and the other docgen-relevant TS
 * option (`reactDocgenTypescriptOptions`, including `propFilter`) applies solely to the
 * `react-docgen-typescript` engine used by the legacy manifest path — not here.
 */
import {
  type TypeScriptSpecifierForDocgen,
  createLazyDocgenMiddleware,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware } from 'storybook/internal/types';

import { loadDocgenTypeScript } from '@storybook/component-meta-typescript';

import { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import { buildDocgenPayload } from './buildDocgen.ts';

export interface ReactDocgenOptions {
  typeScriptSpecifier?: TypeScriptSpecifierForDocgen;
}

/**
 * Builds the React docgen middleware. Owns one {@link ComponentMetaManager} for the worker's
 * lifetime so the TypeScript language service / program stays warm across components. The manager is
 * created lazily on the first eligible request and memoized; when TypeScript is unavailable the
 * middleware passes through to the rest of the chain.
 */
export const createDocgenProvider = ({
  typeScriptSpecifier,
}: ReactDocgenOptions = {}): DocgenMiddleware =>
  createLazyDocgenMiddleware({
    createManager: async () => {
      try {
        return new ComponentMetaManager(await loadDocgenTypeScript(typeScriptSpecifier));
      } catch (err) {
        logger.warn(`React docgen is unavailable. ${err instanceof Error ? err.message : err}`);
        return undefined;
      }
    },
    extract: (componentMetaManager, input) => buildDocgenPayload(input, { componentMetaManager }),
  });
