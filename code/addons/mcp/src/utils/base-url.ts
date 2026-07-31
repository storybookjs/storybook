export function resolveBaseUrl({
  origin,
  basePath = '/',
}: {
  origin: string;
  basePath?: string;
}): string {
  return `${origin.replace(/\/+$/, '')}${basePath}`.replace(/\/+$/, '');
}
