import { dirname, join, normalize, relative, resolve } from 'pathe';

import { storybookConfigExtensions } from './extensions.ts';

/** Default React Native on-device Storybook config directory name. */
export const RN_STORYBOOK_DIR = '.rnstorybook';

export const DOCUMENTED_PREVIEW_IMPORT = '#.storybook/preview';

export function isReactNativeStorybookPath(fileOrDir?: string): boolean {
  if (!fileOrDir) {
    return false;
  }

  const normalized = normalize(fileOrDir);
  return (
    normalized === RN_STORYBOOK_DIR ||
    normalized.startsWith(`${RN_STORYBOOK_DIR}/`) ||
    normalized.endsWith(`/${RN_STORYBOOK_DIR}`) ||
    normalized.includes(`/${RN_STORYBOOK_DIR}/`)
  );
}

export function webPreviewCandidates(nativeConfigPath: string): string[] {
  const parts = resolve(nativeConfigPath).split('/');
  const index = parts.lastIndexOf(RN_STORYBOOK_DIR);
  if (index <= 0) {
    return [];
  }

  const projectDir = parts.slice(0, index).join('/');
  return storybookConfigExtensions.map((extension) =>
    join(projectDir, '.storybook', `preview${extension}`)
  );
}

export function hasSiblingReactNativeConfig(
  configDir: string | undefined,
  exists: (file: string) => boolean
): boolean {
  if (!configDir) {
    return false;
  }

  return exists(join(dirname(resolve(configDir)), RN_STORYBOOK_DIR));
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
  const relativePath = relative(resolve(fromDirectory), resolve(previewFile));
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
