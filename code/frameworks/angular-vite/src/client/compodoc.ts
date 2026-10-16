/**
 * The Compodoc parsing and its browser adapter live in `@storybook/angular-compodoc`, shared with
 * `@storybook/angular` and with this package's Node docgen worker. This module keeps the
 * historical `client/compodoc` import path alive and resolves this framework's `propsTable`
 * option for the shared adapter.
 */
import {
  extractArgTypes as extractArgTypesShared,
  extractArgTypesFromData as extractArgTypesFromDataShared,
} from '@storybook/angular-compodoc/browser';

/**
 * Compodoc encodes member visibility only as raw TypeScript `SyntaxKind` numbers, which the frozen
 * legacy pipeline deliberately does not interpret, so `api` is not answerable here and reads as
 * `all`; the preset warns when a user asks for it. Left undefined when Vite's `define` never ran,
 * which is how a portable-stories host imports this file, so the shared adapter falls back to the
 * deprecated `angularFilterNonInputControls` feature.
 */
const filterNonInputControls =
  typeof STORYBOOK_ANGULAR_OPTIONS === 'undefined' ||
  STORYBOOK_ANGULAR_OPTIONS.propsTable === undefined
    ? undefined
    : STORYBOOK_ANGULAR_OPTIONS.propsTable === 'inputs';

export const extractArgTypes = (component: Parameters<typeof extractArgTypesShared>[0]) =>
  extractArgTypesShared(component, { filterNonInputControls });

export const extractArgTypesFromData = (
  componentData: Parameters<typeof extractArgTypesFromDataShared>[0]
) => extractArgTypesFromDataShared(componentData, { filterNonInputControls });

export {
  checkValidCompodocJson,
  checkValidComponentOrDirective,
  extractComponentDescription,
  extractType,
  findComponentByName,
  getCompodocJson,
  isMethod,
  setCompodocJson,
} from '@storybook/angular-compodoc/browser';
