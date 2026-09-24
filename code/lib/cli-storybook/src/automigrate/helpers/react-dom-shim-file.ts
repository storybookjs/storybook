import { readdir } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|vue|svelte)$/;
const DATA_FILE = /\.jsonc?$/;
const HTML_FILE = /\.html?$/;
const ASTRO_FILE = /\.astro$/;
const INERT_FILE =
  /\.(?:avif|bmp|css|csv|eot|gif|ico|jpe?g|lock|md|otf|png|scss|txt|ttf|webp|woff2?)$/;
const INERT_NAME =
  /^(?:CHANGELOG|LICENSE|README)$|^(?:package-lock|npm-shrinkwrap)\.json$|^(?:bun|npm|package|pnpm|yarn)\.lock(?:\.b)?$|^pnpm-workspace\.yaml$/;
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules']);
const SHIM = '@storybook/react-dom-shim';

type WorkspaceFileKind = 'astro' | 'data' | 'html' | 'inert' | 'opaque' | 'source';
type WorkspaceFiles = { complete: boolean; files: string[] };

export const workspaceFileKind = (filePath: string): WorkspaceFileKind => {
  const name = basename(filePath);
  if (INERT_FILE.test(filePath) || INERT_NAME.test(name)) return 'inert';
  if (SOURCE_FILE.test(filePath)) return 'source';
  if (DATA_FILE.test(filePath)) return 'data';
  if (HTML_FILE.test(filePath)) return 'html';
  if (ASTRO_FILE.test(filePath)) return 'astro';
  return 'opaque';
};

export const workspaceFiles = async (directory: string): Promise<WorkspaceFiles> => {
  try {
    const entries = await readdir(directory, { encoding: 'utf8', withFileTypes: true });

    const files: string[] = [];
    let complete = true;
    for (const entry of entries) {
      const filePath = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        complete = false;
        continue;
      }
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
        const descendants = await workspaceFiles(filePath);
        complete &&= descendants.complete;
        files.push(...descendants.files);
      } else if (entry.isFile()) {
        files.push(filePath);
      }
    }
    return { complete, files };
  } catch {
    return { complete: false, files: [] };
  }
};

const cssEscapes = (source: string) =>
  source.replace(/\\([\da-f]{1,6})\s?/gi, (_match, value: string) => {
    const codePoint = Number.parseInt(value, 16);
    return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '';
  });

export const inertFileDiagnostic = (source: string, filePath: string): string | undefined =>
  /\.s?css$/.test(filePath) && cssEscapes(source).includes(SHIM)
    ? `${filePath}: contains a react-dom-shim reference that cannot be removed safely`
    : undefined;

const decodeAsciiCodePoints = (source: string) =>
  source.replace(
    /\\x([\da-f]{2})|\\u([\da-f]{4})|\\u\{([\da-f]+)\}|%([\da-f]{2})|&#(\d+);|&#x([\da-f]+);/gi,
    (
      match: string,
      hex: string | undefined,
      unicode: string | undefined,
      unicodeBrace: string | undefined,
      percent: string | undefined,
      decimal: string | undefined,
      hexEntity: string | undefined
    ) => {
      const value = hex || unicode || unicodeBrace || percent || decimal || hexEntity;
      if (!value) return match;
      const radix = decimal ? 10 : 16;
      const codePoint = Number.parseInt(value, radix);
      return codePoint <= 0x7f ? String.fromCodePoint(codePoint) : match;
    }
  );

const LOADER_CAPABILITY =
  /import\s*\(|require\s*\(|require\s*\.\s*resolve|createRequire|module\s*\.\s*require|import\s*\.\s*meta\s*\.\s*resolve/i;
const EXECUTABLE_SVG =
  /<\s*(?:script|foreignobject|iframe|object|embed)\b|(?:\s|<)on[a-z][\w:-]*\s*=|javascript\s*:/i;
const ENCODING_SPELLING = /\\x\S{2}|\\u(?:\{[^}\s]*\}|\S{4})|%\S{2}|&#(?:x[^;\s]*|[^;\s]*);/gi;

export const opaqueFileDiagnostic = (source: string, filePath: string): string | undefined => {
  const decoded = decodeAsciiCodePoints(source).toLowerCase();
  const hasShimReference =
    decoded.includes('react-dom-shim') ||
    decoded
      .replace(ENCODING_SPELLING, '')
      .replace(/[^a-z\d]/g, '')
      .includes('storybookreactdomshim');
  const hasExecutableSvg = /\.svg$/i.test(filePath) && EXECUTABLE_SVG.test(decoded);
  return hasShimReference || LOADER_CAPABILITY.test(decoded) || hasExecutableSvg
    ? `${filePath}: contains a possible react-dom-shim consumer that cannot be removed safely`
    : undefined;
};

export const pnpmWorkspaceDiagnostic = (source: string, filePath: string): string | undefined =>
  source.includes('react-dom-shim') || source.includes('@storybook') || /\\[xuU]/.test(source)
    ? `${filePath}: contains a react-dom-shim reference that cannot be removed safely`
    : undefined;

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
