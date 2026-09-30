import { SVELTE_CSF_IMPORT_SOURCES } from '../constants.ts';
import { isOneOf } from './is-one-of.ts';

export function isSvelteCsfImportSource(source: unknown): boolean {
  return typeof source === 'string' && isOneOf(SVELTE_CSF_IMPORT_SOURCES, source);
}
