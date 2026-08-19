/**
 * Remove punctuation and illegal characters from a story ID.
 *
 * See https://gist.github.com/davidjrice/9d2af51100e41c6c4b4a
 */
export const sanitize = (string: string) => {
  return string
    .toLowerCase()

    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const sanitizeSafe = (string: string, part: string) => {
  const sanitized = sanitize(string);
  if (sanitized === '') {
    throw new Error(`Invalid ${part} '${string}', must include alphanumeric characters`);
  }
  return sanitized;
};

/** Generate a storybook ID from a component/kind and story name. */
export const toId = (kind: string, name?: string) =>
  `${sanitizeSafe(kind, 'kind')}${name ? `--${sanitizeSafe(name, 'name')}` : ''}`;

/** Generate a storybook test ID from a story ID and test name. */
export const toTestId = (parentId: string, testName: string) =>
  `${parentId}:${sanitizeSafe(testName, 'test')}`;

export { isExportStory, storyNameFromExport, type IncludeExcludeOptions } from './export-story.ts';

export interface SeparatorOptions {
  rootSeparator: string | RegExp;
  groupSeparator: string | RegExp;
}

/** Parse out the component/kind name from a path, using the given separator config. */
export const parseKind = (kind: string, { rootSeparator, groupSeparator }: SeparatorOptions) => {
  const [root, remainder] = kind.split(rootSeparator, 2);
  const groups = (remainder || kind).split(groupSeparator).filter((i) => !!i);

  // when there's no remainder, it means the root wasn't found/split
  return {
    root: remainder ? root : null,
    groups,
  };
};

/** Combine a set of project / meta / story tags, removing duplicates and handling negations. */
export const combineTags = (...tags: string[]): string[] => {
  const result = tags.reduce((acc, tag) => {
    if (tag.startsWith('!')) {
      acc.delete(tag.slice(1));
    } else {
      acc.add(tag);
    }
    return acc;
  }, new Set<string>());
  return Array.from(result);
};

export { includeConditionalArg } from './includeConditionalArg.ts';
export * from './story.ts';
export * from './csf-factories.ts';
export * from './core-annotations.ts';
