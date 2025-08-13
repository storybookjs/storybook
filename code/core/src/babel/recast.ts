import recastRaw from 'recast';
import type * as recastTypes from 'recast';

// this is because recast types are (incorrectly) ESM, but runtime is CJS
const recast = recastRaw as typeof recastTypes;

export { recast };
