import type { getEntries } from '../entries';

export function noExternals(entry: ReturnType<typeof getEntries>[0]): boolean {
  return entry.externals.length === 0 && entry.internals.length === 0;
}
export function isNode(entry: ReturnType<typeof getEntries>[0]): boolean {
  return !!entry.node;
}
export function isBrowser(entry: ReturnType<typeof getEntries>[0]): boolean {
  return !!entry.browser;
}
