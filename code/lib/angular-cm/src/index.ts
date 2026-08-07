/**
 * The in-process Angular docgen analyzer. It emits the same Compodoc-JSON subset that
 * `@storybook/angular-compodoc` converts into argTypes, so both producers share one conversion.
 */
export { AngularComponentMetaManager } from './manager.ts';
export type { AngularClassMeta, AngularComponentMetaResult } from './types.ts';
