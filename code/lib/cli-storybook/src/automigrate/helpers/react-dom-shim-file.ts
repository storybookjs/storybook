import { basename, dirname, relative, resolve, sep } from 'node:path';

const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|vue|svelte|mdx)$/;
const DATA_FILE = /\.jsonc?$/;
const HTML_FILE = /\.html?$/;
const ASTRO_FILE = /\.astro$/;
const INERT_FILE =
  /\.(?:avif|bmp|css|csv|eot|gif|ico|jpe?g|lock|md|otf|png|scss|txt|ttf|webp|woff2?)$/;
const INERT_NAME =
  /^(?:CHANGELOG|LICENSE|README)$|^(?:bun|npm|package|pnpm|yarn)\.lock(?:\.b)?$|^pnpm-workspace\.yaml$/;

export type WorkspaceFileKind = 'astro' | 'data' | 'html' | 'inert' | 'manual' | 'source';

export const workspaceFileKind = (filePath: string): WorkspaceFileKind => {
  const name = basename(filePath);
  if (INERT_FILE.test(filePath) || INERT_NAME.test(name)) return 'inert';
  if (SOURCE_FILE.test(filePath)) return 'source';
  if (DATA_FILE.test(filePath)) return 'data';
  if (HTML_FILE.test(filePath)) return 'html';
  if (ASTRO_FILE.test(filePath)) return 'astro';
  return 'manual';
};

export const linkedScriptDiagnostic = (
  source: string,
  filePath: string,
  workspaceRoot: string,
  filePaths: string[]
): string | undefined => {
  if (/^[a-z][a-z\d+.-]*:/i.test(source) || source.startsWith('//')) {
    return `${filePath}: contains an external script that cannot be scanned safely`;
  }
  const pathname = source.split(/[?#]/, 1)[0];
  if (!pathname) return `${filePath}: contains an unresolved script that cannot be scanned safely`;
  const target = resolve(
    pathname.startsWith('/') ? workspaceRoot : dirname(filePath),
    pathname.startsWith('/') ? `.${pathname}` : pathname
  );
  if (relative(workspaceRoot, target).startsWith(`..${sep}`) || !filePaths.includes(target)) {
    return `${filePath}: contains a script outside the scanned workspace`;
  }
  return workspaceFileKind(target) === 'source'
    ? undefined
    : `${filePath}: links to an unsupported script source`;
};
