import { join, relative, resolve, sep } from 'node:path';

/** Default React Native on-device Storybook config directory name. */
export const RN_STORYBOOK_DIR = '.rnstorybook';

export const DOCUMENTED_PREVIEW_IMPORT = '#.storybook/preview';

const WEB_PREVIEW_FILENAMES = [
  'preview.ts',
  'preview.tsx',
  'preview.js',
  'preview.jsx',
  'preview.mjs',
];

const normalizePath = (fileOrDir: string) => fileOrDir.replace(/\\/g, '/');

export function isReactNativeStorybookPath(fileOrDir?: string): boolean {
  if (!fileOrDir) {
    return false;
  }

  const normalized = normalizePath(fileOrDir);
  return (
    normalized === RN_STORYBOOK_DIR ||
    normalized.startsWith(`${RN_STORYBOOK_DIR}/`) ||
    normalized.endsWith(`/${RN_STORYBOOK_DIR}`) ||
    normalized.includes(`/${RN_STORYBOOK_DIR}/`)
  );
}

export function webPreviewCandidates(nativeConfigPath: string): string[] {
  const parts = resolve(nativeConfigPath).split(sep);
  const index = parts.lastIndexOf(RN_STORYBOOK_DIR);
  if (index <= 0) {
    return [];
  }

  const projectDir = parts.slice(0, index).join(sep);
  return WEB_PREVIEW_FILENAMES.map((name) => join(projectDir, '.storybook', name));
}

export function previewFileForImports(
  nativeConfigPath: string,
  exists: (file: string) => boolean
): string {
  return (
    webPreviewCandidates(nativeConfigPath).find((candidate) => exists(candidate)) ??
    nativeConfigPath
  );
}

function packageRelativeImport(fromDirectory: string, previewFile: string): string {
  const relativePath = relative(resolve(fromDirectory), resolve(previewFile)).replaceAll('\\', '/');
  return relativePath.startsWith('./') || relativePath.startsWith('../')
    ? relativePath
    : `./${relativePath}`;
}

export function applyPreviewImportsMap(
  packageJson: { imports?: Record<string, unknown> },
  previewFile: string,
  fromDirectory: string
): boolean {
  const target = packageRelativeImport(fromDirectory, previewFile);
  const current = packageJson.imports ?? {};

  if (current[DOCUMENTED_PREVIEW_IMPORT] === target) {
    return false;
  }

  packageJson.imports = {
    ...current,
    [DOCUMENTED_PREVIEW_IMPORT]: target,
  };
  return true;
}
