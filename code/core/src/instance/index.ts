export * from './public.ts';

export { legacyPreset } from './addons.ts';
export type { LegacyPreset } from './addons.ts';
export type {
  LegacyAdapter,
  LegacyAdapterInput,
  LegacyAdapterResult,
  LegacyRegistrar,
} from './types.ts';

export { getInstanceContext } from '../shared/instance-context.ts';
export { commonAddon as internal_commonAddon } from './common-addon.ts';
export { defineLegacyFieldOptions as internal_defineLegacyFieldOptions } from './legacy-hooks.ts';
