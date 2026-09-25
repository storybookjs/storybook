export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const trimmedOrUndefined = (text: unknown): string | undefined =>
  typeof text === 'string' ? text.trim() || undefined : undefined;

export function deprecationMessage(deprecated: string | boolean | undefined): string | undefined {
  if (!deprecated) {
    return undefined;
  }
  return typeof deprecated === 'string' ? deprecated : 'deprecated';
}
