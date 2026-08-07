/**
 * Compodoc's answer to "what does this component declare".
 *
 * This is the only place in the snippet path that knows `documentation.json` exists. Snippet
 * generation consumes {@link AngularComponentResolver}, so a different metadata source - an
 * in-process Angular component meta service, say - is a second implementation of this file rather
 * than a change to any of the generators.
 */
import type { ResolvedMetaComponent } from 'storybook/internal/common';

import { join } from 'node:path';

import type { CompodocJson, CompodocParsingLogger } from '@storybook/angular-compodoc';
import { extractArgTypesFromData, htmlToText } from '@storybook/angular-compodoc';
import { DOCUMENTATION_JSON } from '../compodoc-config.ts';
import { findCompodocEntry } from './build-docgen.ts';
import type { AngularComponentResolver } from './build-story-docs.ts';

export interface CompodocComponentResolverOptions {
  /** Directory Compodoc's relative `file` paths resolve against. */
  workspaceRoot: string;
  /** Directory Compodoc writes {@link DOCUMENTATION_JSON} into. */
  outputDir: string;
  readDocumentationJson: (path: string) => CompodocJson;
  logger: CompodocParsingLogger;
}

/**
 * `extractArgTypesFromData` already resolves a `model()` into an input plus a `${name}Change`
 * output, so the binding names it reports are the ones a template may bind.
 */
export const createCompodocComponentResolver =
  (options: CompodocComponentResolverOptions): AngularComponentResolver =>
  (component: ResolvedMetaComponent) => {
    const documentationJson = join(options.outputDir, DOCUMENTATION_JSON);
    let compodocJson: CompodocJson;
    try {
      compodocJson = options.readDocumentationJson(documentationJson);
    } catch (error) {
      options.logger.debug(
        `Could not read ${documentationJson}: ${error instanceof Error ? error.message : String(error)}.`
      );
      return undefined;
    }

    const entry = findCompodocEntry(compodocJson, component, options.workspaceRoot);
    if (!entry) {
      options.logger.debug(
        `Compodoc has no entry for "${component.exportName}" (${component.path ?? 'unresolved'}).`
      );
      return undefined;
    }

    const argTypes = extractArgTypesFromData(entry, {
      compodocJson,
      // Snippets bind inputs and outputs, which this flag never filters.
      filterNonInputControls: false,
      logger: options.logger,
      unwrapHtml: htmlToText,
    });

    const named = (category: string) =>
      Object.entries(argTypes ?? {})
        .filter(([, argType]) => argType?.table?.category === category)
        .map(([name]) => name);

    return {
      name: entry.name ?? component.exportName,
      selector: entry.selector,
      inputs: named('inputs'),
      outputs: named('outputs'),
    };
  };
