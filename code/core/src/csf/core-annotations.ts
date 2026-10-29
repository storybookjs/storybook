import type { StorybookTypes } from '@storybook/core/internal/types';

/** Register the types contributed by built-in feature annotations. */
export interface BuiltInTypes {}

export type CoreTypes = StorybookTypes & BuiltInTypes;

/** The built-in features' globals; `unknown` while no package registers `BuiltInTypes`. */
export type CoreGlobals = CoreTypes extends { globals: infer TGlobals } ? TGlobals : unknown;
