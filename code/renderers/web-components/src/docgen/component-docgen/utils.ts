export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export const trimmedOrUndefined = (text: unknown): string | undefined =>
  typeof text === 'string' ? text.trim() || undefined : undefined;
