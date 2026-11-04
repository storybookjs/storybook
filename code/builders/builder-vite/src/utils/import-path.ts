import { normalize, relative } from 'pathe';

/**
 * The path of a file relative to the working directory, in the form the story index uses: with a
 * leading './', e.g. './src/Foo.stories.js', or a leading '../', e.g. '../src/Foo.stories.js'.
 */
export function toImportPath(path: string): string {
  const relativePath = normalize(relative(process.cwd(), path));
  return relativePath.startsWith('../') ? relativePath : `./${relativePath}`;
}
