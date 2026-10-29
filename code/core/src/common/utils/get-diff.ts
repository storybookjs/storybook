import { diffLines } from 'diff';

/**
 * Get a diff between two strings
 *
 * @example
 *
 * ```ts
 * const before = 'foo\nbar\nbaz';
 * const after = 'foo\nbaz';
 * const diff = getDiff(before, after);
 * console.log(diff);
 * //   foo
 * // - bar
 * //   baz
 * ```
 *
 * @param before The original string
 * @param after The new string
 * @returns The diff as a string
 */
export function getDiff(before: string, after: string): string {
  const context = 4;
  return diffLines(before, after, {})
    .map((r, index, l) => {
      const lines = r.value.split('\n');

      if (r.removed) {
        return r.value
          .split('\n')
          .map((v) => `- ${v}`)
          .join('\n');
      }
      if (r.added) {
        return r.value
          .split('\n')
          .map((v) => `+ ${v}`)
          .join('\n');
      }

      if (index === 0) {
        const sliced = lines.slice(0 - context);

        if (sliced.length !== lines.length) {
          sliced.unshift('...');
        }
        return sliced.map((v) => `  ${v}`).join('\n');
      }

      if (index === l.length - 1) {
        const sliced = lines.slice(0, context);

        if (sliced.length !== lines.length) {
          sliced.push('...');
        }
        return sliced.map((v) => `  ${v}`).join('\n');
      }

      if (lines.length <= context * 2 + 1) {
        return lines.map((v) => `  ${v}`).join('\n');
      }
      return [
        //
        ...lines.slice(0, context).map((v) => `  ${v}`),
        '...',
        ...lines.slice(0 - context).map((v) => `  ${v}`),
      ].join('\n');
    })
    .join('\n');
}
