export const buildNavigationUrl = (
  path: string,
  queryParams: Record<string, string | null | undefined> = {}
): string => {
  const params = Object.entries(queryParams)
    .filter(([, v]) => v !== null && v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`);
  return [path, ...params].join('&');
};
