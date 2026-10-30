import { isAbsolute, join, normalize, relative } from 'pathe';

import { ManagerDocsError } from '../errors.ts';

export function mdxFileInProject(projectRoot: string, importPath: string): string {
  if (!importPath.toLowerCase().endsWith('.mdx')) {
    throw new ManagerDocsError(`Refusing to read "${importPath}" because it is not an MDX file.`);
  }
  const absolute = normalize(join(projectRoot, importPath));
  const fromRoot = relative(projectRoot, absolute);
  if (fromRoot === '' || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    throw new ManagerDocsError(`Refusing to read "${importPath}" outside the project.`);
  }
  return absolute;
}

export function projectMdxReader(
  projectRoot: string,
  readFile: (absolutePath: string) => Promise<string>
): (importPath: string) => Promise<string> {
  return (importPath) => readFile(mdxFileInProject(projectRoot, importPath));
}
