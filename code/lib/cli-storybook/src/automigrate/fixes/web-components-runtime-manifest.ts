import { babelParse, types as t } from 'storybook/internal/babel';
import { findFilesUp } from 'storybook/internal/common';
import type { ConfigFile } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import { SupportedRenderer } from 'storybook/internal/types';

import { dirname, relative, resolve } from 'pathe';

import type { FixFiles } from '../fix-files.ts';
import { getRendererName } from '../helpers/mainConfigFile.ts';
import { countReferences, removeTopLevelCall, topLevelCalls } from '../helpers/preview-call.ts';
import { findWorkspaceFiles, readJsonFile } from '../helpers/workspace-files.ts';
import type { FixTransform } from '../pipeline.ts';
import type { Fix } from '../types.ts';

const SETTER_NAMES = ['setCustomElementsManifest', 'setCustomElements'] as const;
const WEB_COMPONENTS_PACKAGES = new Set([
  '@storybook/web-components',
  '@storybook/web-components-vite',
]);
const AUTOMIGRATE_COMMAND = 'storybook automigrate web-components-runtime-manifest';

type SetterName = (typeof SETTER_NAMES)[number];

type ManifestSource = { from: 'package-json'; paths: string[] } | { from: 'file'; path: string };

export interface WebComponentsRuntimeManifestOptions {
  /** Setters the preview references, in migration order. */
  setterNames: SetterName[];
  /** Manifest path relative to the config dir; `null` when `package.json#customElements` already names it. */
  manifestPath: string | null;
}

export const webComponentsRuntimeManifest: Fix<WebComponentsRuntimeManifestOptions> = {
  id: 'web-components-runtime-manifest',
  link: 'https://storybook.js.org/docs/get-started/frameworks/web-components-vite',

  async check({
    files,
    mainConfig,
    mainConfigPath,
    previewConfigPath,
  }): Promise<WebComponentsRuntimeManifestOptions | null> {
    if (
      getRendererName(mainConfig) !== SupportedRenderer.WEB_COMPONENTS ||
      !mainConfigPath ||
      !previewConfigPath ||
      mainConfig.features?.docgenServer === false
    ) {
      return null;
    }

    const program = parsePreview(await files.read(previewConfigPath));
    if (!program) {
      return null;
    }

    const setterNames = findReferencedSetterNames(program);
    if (setterNames.length === 0) {
      return null;
    }

    const configDir = dirname(mainConfigPath);
    const source =
      findPreviewImportManifest(program, setterNames, dirname(previewConfigPath)) ??
      (await findPackageJsonManifest(files, configDir)) ??
      (await findWorkspaceManifest());
    if (!source) {
      return null;
    }
    const manifestPaths = source.from === 'file' ? [source.path] : source.paths;
    const unreadableManifest = await findUnreadableManifestPath(files, manifestPaths);
    if (unreadableManifest) {
      logInvalidManifestWarning(previewConfigPath, setterNames[0], unreadableManifest);
      return null;
    }
    const manifestPath = source.from === 'file' ? relative(configDir, source.path) : null;

    return {
      setterNames,
      manifestPath,
    };
  },

  prompt: (): string =>
    "The @storybook/web-components runtime manifest API is deprecated. We'll remove the runtime calls and add the manifest path to your main config.",

  transform: ({ result }): FixTransform[] => [
    {
      filter: { kind: ['main'] },
      editConfig: (main): void => {
        if (typeof result.manifestPath === 'string') {
          const framework = main.getValue(['framework']);
          if (typeof framework === 'string') {
            main.set(['framework'], {
              name: framework,
              options: { customElementsManifest: result.manifestPath },
            });
          } else {
            main.set(['framework', 'options', 'customElementsManifest'], result.manifestPath);
          }
        }
      },
    },
    {
      filter: { kind: ['preview'], code: 'setCustomElements' },
      editConfig: (preview, { id }): void => {
        removePreviewWiring(preview, id, result.setterNames);
      },
    },
  ],
};

const parsePreview = (source: string): t.Program | null => {
  try {
    return babelParse(source).program;
  } catch {
    return null;
  }
};

const findReferencedSetterNames = (program: t.Program): SetterName[] =>
  SETTER_NAMES.filter((name) => countReferences(program, name) > 0);

const findPreviewImportManifest = (
  program: t.Program,
  setterNames: SetterName[],
  previewDir: string
): ManifestSource | null => {
  for (const setterName of setterNames) {
    for (const node of topLevelCalls(program, setterName)) {
      const { arguments: args } = node.expression as t.CallExpression;
      if (args.length !== 1) {
        continue;
      }
      const [argument] = args;
      if (!t.isIdentifier(argument)) {
        continue;
      }
      const specifier = findDefaultJsonImportSpecifier(program, argument.name);
      if (specifier) {
        return { from: 'file', path: resolve(previewDir, specifier) };
      }
    }
  }
  return null;
};

const findPackageJsonManifest = async (
  files: Pick<FixFiles, 'read'>,
  configDir: string
): Promise<ManifestSource | null> => {
  const packageJsonPath = findFilesUp(['package.json'], configDir)[0];
  if (!packageJsonPath) {
    return null;
  }

  const packageJson = await readJsonFile(files, packageJsonPath);
  const paths = getPackageCustomElementsPaths(packageJson?.customElements, packageJsonPath);
  return paths.length > 0 ? { from: 'package-json', paths } : null;
};

const getPackageCustomElementsPaths = (value: unknown, packageJsonPath: string): string[] => {
  const packageDir = dirname(packageJsonPath);
  if (typeof value === 'string') {
    return value.length > 0 ? [resolve(packageDir, value)] : [];
  }
  if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string')) {
    return value.map((item) => resolve(packageDir, item));
  }
  return [];
};

const findWorkspaceManifest = async (): Promise<ManifestSource | null> => {
  const paths = await findWorkspaceFiles('custom-elements.json');
  return paths.length === 1 ? { from: 'file', path: paths[0] } : null;
};

const isCustomElementsManifest = (json: unknown): boolean =>
  typeof json === 'object' &&
  json !== null &&
  Array.isArray((json as { modules?: unknown }).modules);

const findUnreadableManifestPath = async (
  files: Pick<FixFiles, 'read'>,
  paths: string[]
): Promise<string | null> => {
  for (const path of paths) {
    if (!isCustomElementsManifest(await readJsonFile(files, path))) {
      return path;
    }
  }
  return null;
};

const logInvalidManifestWarning = (
  previewConfigPath: string,
  setterName: SetterName,
  path: string
): void =>
  logger.warn(
    `Left the ${setterName}() call in ${previewConfigPath} alone: ${path} is not a readable ` +
      `Custom Elements Manifest. Generate one with @custom-elements-manifest/analyzer, then rerun ` +
      `"${AUTOMIGRATE_COMMAND}".`
  );

const findDefaultJsonImportSpecifier = (program: t.Program, name: string): string | null => {
  for (const node of program.body) {
    if (!t.isImportDeclaration(node) || !isRelativeJsonSpecifier(node.source.value)) {
      continue;
    }
    if (
      node.specifiers.some(
        (specifier) => t.isImportDefaultSpecifier(specifier) && specifier.local.name === name
      )
    ) {
      return node.source.value;
    }
  }
  return null;
};

const isRelativeJsonSpecifier = (specifier: string): boolean =>
  specifier.endsWith('.json') && (specifier.startsWith('./') || specifier.startsWith('../'));

const logManualRemovalHint = (
  previewConfigPath: string,
  setterName: SetterName,
  reason: string
): void =>
  logger.warn(
    `Left the ${setterName} wiring in ${previewConfigPath} alone: ${reason}. ` +
      `Remove the runtime call by hand when convenient.`
  );

const removePreviewWiring = (
  preview: ConfigFile,
  previewConfigPath: string,
  setterNames: SetterName[]
): void => {
  for (const setterName of setterNames) {
    const reason = removeTopLevelCall(preview._ast.program, {
      callee: setterName,
      calleeSources: WEB_COMPONENTS_PACKAGES,
    });
    if (reason) {
      logManualRemovalHint(previewConfigPath, setterName, reason);
      continue;
    }
    logger.debug(`Removed the ${setterName} wiring from ${previewConfigPath}`);
  }
};
