import type { ResolvedMetaComponent } from 'storybook/internal/common';

import type { CompodocJson, CompodocParsingLogger } from '@storybook/angular-compodoc';
import { extractArgTypesFromData, htmlToText } from '@storybook/angular-compodoc';
import { findCompodocEntry } from './build-docgen.ts';
import type { AngularComponentResolver } from './build-story-docs.ts';

export interface CompodocComponentResolverOptions {
  /** Directory Compodoc's relative `file` paths resolve against. */
  workspaceRoot: string;
  /**
   * Compodoc's metadata. Called per resolve rather than captured once, so a Compodoc run that
   * finishes mid-session is picked up; where it comes from is the caller's business.
   */
  readMetadata: () => CompodocJson;
  logger: CompodocParsingLogger;
}

/**
 * `extractArgTypesFromData` already resolves a `model()` into an input plus a `${name}Change`
 * output, so the binding names it reports are the ones a template may bind.
 */
export const createCompodocComponentResolver =
  (options: CompodocComponentResolverOptions): AngularComponentResolver =>
  (component: ResolvedMetaComponent) => {
    let compodocJson: CompodocJson;
    try {
      compodocJson = options.readMetadata();
    } catch (error) {
      options.logger.debug(
        `Could not read Compodoc metadata: ${error instanceof Error ? error.message : String(error)}.`
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
