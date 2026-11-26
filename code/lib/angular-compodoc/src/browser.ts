import { logger } from 'storybook/internal/client-logger';

import type { CompodocJson, Component, Directive, Property } from './compodoc-types.ts';
import {
  extractArgTypesFromData as extractArgTypesFromDataShared,
  extractType as extractTypeShared,
  getComponentData,
} from './index.ts';

/**
 * Browser adapter over the environment-agnostic parsing in this package's root entry.
 *
 * It supplies the four things the shared module refuses to reach for itself: the Compodoc JSON off
 * the global, the `angularFilterNonInputControls` feature flag, a logger, and the HTML unwrapper.
 */

/**
 * Who decides which members the props table renders.
 *
 * `@storybook/angular-vite` supersedes the `angularFilterNonInputControls` feature with a
 * `propsTable` framework option, so it passes its own answer rather than letting this adapter read
 * a flag that no longer owns the decision there. `@storybook/angular` passes nothing and keeps the
 * feature.
 */
export interface CompodocExtractOptions {
  filterNonInputControls?: boolean;
}

export {
  checkValidCompodocJson,
  checkValidComponentOrDirective,
  findComponentByName,
  isMethod,
} from './index.ts';

export const setCompodocJson = (compodocJson: CompodocJson) => {
  globalThis.__STORYBOOK_COMPODOC_JSON__ = compodocJson;
};

export const getCompodocJson = (): CompodocJson => globalThis.__STORYBOOK_COMPODOC_JSON__;

export const extractType = (property: Property, defaultValue: any) =>
  extractTypeShared(property, defaultValue, getCompodocJson());

/** The preview has a real HTML parser; only a Node host needs the DOM-free replacement. */
const unwrapHtml = (html: unknown): string =>
  new globalThis.DOMParser().parseFromString(html as string, 'text/html').body.textContent ?? '';

export const extractArgTypesFromData = (
  componentData: Parameters<typeof extractArgTypesFromDataShared>[0],
  // Asserted rather than optional-chained: a preview without `FEATURES` is broken, and this has
  // always thrown there rather than silently reading the flag as `false`.
  {
    filterNonInputControls = globalThis.FEATURES!.angularFilterNonInputControls,
  }: CompodocExtractOptions = {}
) =>
  extractArgTypesFromDataShared(componentData, {
    compodocJson: getCompodocJson(),
    filterNonInputControls,
    logger,
    unwrapHtml,
  });

export const extractArgTypes = (
  component: Component | Directive,
  options?: CompodocExtractOptions
) => {
  const componentData = getComponentData(component, { compodocJson: getCompodocJson(), logger });
  return componentData && extractArgTypesFromData(componentData, options);
};

export const extractComponentDescription = (component: Component | Directive) => {
  const componentData = getComponentData(component, { compodocJson: getCompodocJson(), logger });
  return componentData && (componentData.rawdescription || componentData.description);
};
