import { stringify } from 'picoquery';

// Storybook serializes these itself; encoding them would escape their `:` and `;`.
const SERIALIZED_PARAMS = ['args', 'globals', 'tags', 'statuses'];

export const buildNavigationUrl = (
  path: string,
  queryParams: Record<string, string | null | undefined> = {}
): string => {
  const hashIndex = path.indexOf('#');
  const [pathname, hash] =
    hashIndex === -1 ? [path, ''] : [path.slice(0, hashIndex), path.slice(hashIndex)];
  const params = Object.entries(queryParams)
    .filter(([k, v]) => k !== 'path' && v !== null && v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => (SERIALIZED_PARAMS.includes(k) ? `${k}=${v}` : stringify({ [k]: v })));
  return [pathname, ...params].join('&') + hash;
};
