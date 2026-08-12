/**
 * The Compodoc parsing and its browser adapter live in `@storybook/angular-compodoc`, shared with
 * `@storybook/angular` and with this package's Node docgen worker. This module only keeps the
 * historical `client/compodoc` import path alive.
 */
export {
  checkValidCompodocJson,
  checkValidComponentOrDirective,
  extractArgTypes,
  extractArgTypesFromData,
  extractComponentDescription,
  extractType,
  findComponentByName,
  getCompodocJson,
  isMethod,
  setCompodocJson,
} from '@storybook/angular-compodoc/browser';
