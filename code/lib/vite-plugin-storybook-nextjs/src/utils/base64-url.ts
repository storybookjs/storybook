export function encodeBase64Url(str: string): string {
  const base64 = Buffer.from(str).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function decodeBase64Url(str: string): string {
  const padding = (4 - (str.length % 4)) % 4;
  const withPadding = str + '='.repeat(padding);
  const base64 = withPadding.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString();
}
