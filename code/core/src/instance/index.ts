export * from './public.ts';

export { legacyPreset } from './plugins.ts';
export type { LegacyPreset } from './plugins.ts';
export type {
  LegacyAdapter,
  LegacyAdapterInput,
  LegacyAdapterResult,
  LegacyRegistrar,
} from './types.ts';

export { getInstanceContext } from '../shared/instance-context.ts';
export { commonPlugin as internal_commonPlugin } from './common-plugin.ts';
export { defineLegacyFieldOptions as internal_defineLegacyFieldOptions } from './legacy-hooks.ts';
