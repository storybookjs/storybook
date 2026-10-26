export function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return values.some((candidate) => candidate === value);
}
