/**
 * Parses a semicolon-separated URL filter parameter into included/excluded arrays.
 *
 * Items prefixed with `!` are treated as exclusions.
 * The `transform` callback converts each raw string to the desired type; returning
 * `null` or `undefined` silently skips the entry (e.g. for unknown enum values).
 */
export const parseFilterParam = <T>(
  param: string | undefined,
  transform: (raw: string) => T | null | undefined
): { included: T[]; excluded: T[] } => {
  if (!param) {
    return { included: [], excluded: [] };
  }

  const included: T[] = [];
  const excluded: T[] = [];

  param.split(';').forEach((raw) => {
    if (!raw) {
      return;
    }

    const isExcluded = raw.startsWith('!');
    const value = transform(isExcluded ? raw.slice(1) : raw);

    if (value == null) {
      return;
    }

    if (isExcluded) {
      excluded.push(value);
    } else {
      included.push(value);
    }
  });

  return { included, excluded };
};
