export type SearchResult = Array<string>;

/** File extensions that should be searched for */
const FILE_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx', 'mts', 'ts', 'tsx', 'cts'];

const IGNORED_FILES = [
  '**/node_modules/**',
  '**/*.spec.*',
  '**/*.test.*',
  '**/*.stories.*',
  '**/storybook-static/**',
];

/**
 * Search for files in a directory that match the search query
 *
 * @param searchQuery The search query. This can be a glob pattern
 * @param cwd The directory to search in
 * @param renderer The renderer to use for parsing the files
 * @returns A list of files that match the search query
 */
export async function searchFiles({
  searchQuery,
  cwd,
  ignoredFiles = IGNORED_FILES,
  fileExtensions = FILE_EXTENSIONS,
}: {
  searchQuery: string;
  cwd: string;
  ignoredFiles?: string[];
  fileExtensions?: string[];
}): Promise<SearchResult> {
  // Dynamically import glob because it is a pure ESM module
  const { glob, isDynamicPattern } = await import('tinyglobby');
  if (searchQuery.startsWith('..')) {
    throw new Error('Invalid search query');
  }

  const hasSearchSpecialGlobChars = isDynamicPattern(searchQuery);

  const hasFileExtensionRegex = /(\.[a-z]+)$/i;
  const searchQueryHasExtension = hasFileExtensionRegex.test(searchQuery);
  const fileExtensionsPattern = `{${fileExtensions.join(',')}}`;

  const globbedSearchQuery = hasSearchSpecialGlobChars
    ? searchQuery
    : searchQueryHasExtension
      ? [`**/*${searchQuery}*`, `**/*${searchQuery}*/**`]
      : [
          `**/*${searchQuery}*.${fileExtensionsPattern}`,
          `**/*${searchQuery}*/**/*.${fileExtensionsPattern}`,
        ];

  const entries = await glob(globbedSearchQuery, {
    ignore: ignoredFiles,
    dot: false,
    caseSensitiveMatch: false,
    expandDirectories: false,
    cwd,
  });

  return entries.filter((entry) => fileExtensions.some((ext) => entry.endsWith(`.${ext}`)));
}
