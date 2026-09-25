export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/** The records with a string `name` in a manifest list. */
export function namedItems<T extends { name: string }>(value: unknown): T[] {
  return (
    Array.isArray(value)
      ? value.filter((item) => isRecord(item) && typeof item.name === 'string')
      : []
  ) as T[];
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const trimmedOrUndefined = (text: unknown): string | undefined =>
  typeof text === 'string' ? text.trim() || undefined : undefined;
