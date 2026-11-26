import { dedent } from 'ts-dedent';

/**
 * The export-story helpers live in their own module so the ESLint plugin can bundle them without
 * the rest of these utilities; re-exported here so consumers have one entry for the pure CSF
 * helpers.
 */
export { isExportStory, storyNameFromExport, type IncludeExcludeOptions } from './export-story.ts';

const PREVIEW_FILE_REGEX = /\/preview(.(js|jsx|mjs|ts|tsx))?$/;

/** Whether an import path points at a `.storybook/preview` file, making it a CSF factory source. */
export const isValidPreviewPath = (filepath: string) => PREVIEW_FILE_REGEX.test(filepath);

/**
 * Remove punctuation and illegal characters from a story ID, so it is safe to use in URLs and CSS
 * selectors.
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

const TITLE_PATH_SEPARATOR = /\s*\/\s*/;

/**
 * Split a title into the name and ID of each level, as the sidebar nests them: `Components/Button`
 * gives `components`, then `components-button`. Throws on an empty level, or on a level whose ID
 * repeats its parent's.
 */
export const titleToPath = (title: string): { name: string; id: string }[] =>
  title
    .trim()
    .split(TITLE_PATH_SEPARATOR)
    .reduce<{ name: string; id: string }[]>((paths, name) => {
      const parent = paths.at(-1)?.id;
      const id = sanitize(parent ? `${parent}-${name}` : name);

      if (name.trim() === '') {
        throw new Error(dedent`Invalid title ${title} ending in slash.`);
      }

      if (parent === id) {
        throw new Error(
          dedent`
          Invalid part '${name}', leading to id === parentId ('${id}'), inside title '${title}'

          Did you create a path that uses the separator char accidentally, such as 'Vue <docs/>' where '/' is a separator char? See https://github.com/storybookjs/storybook/issues/6128
          `
        );
      }
      paths.push({ name, id });
      return paths;
    }, []);

/**
 * Combine a set of project / meta / story tags, removing duplicates, handling negations and
 * ignoring empty or whitespace-only tags.
 */
export const combineTags = (...tags: string[]): string[] => {
  const result = tags.reduce((acc, tag) => {
    if (tag.startsWith('!')) {
      acc.delete(tag.slice(1));
    } else if (tag.trim()) {
      // Skip empty tags, they would show up as blank entries in the tag filter.
      acc.add(tag);
    }
    return acc;
  }, new Set<string>());
  return Array.from(result);
};
