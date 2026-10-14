import { babelParse, generate, types as t } from 'storybook/internal/babel';
import { findFilesUp } from 'storybook/internal/common';
import type { ConfigFile } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import { SupportedRenderer } from 'storybook/internal/types';

import { dirname, relative, resolve } from 'pathe';
import { dedent } from 'ts-dedent';

import type { FixFiles } from '../fix-files.ts';
import { getRendererName } from '../helpers/mainConfigFile.ts';
import {
  countReferences,
  isTopLevelCall,
  removeTopLevelCall,
  topLevelCalls,
  topLevelReaders,
} from '../helpers/preview-call.ts';
import { findWorkspaceFiles, readJsonFile } from '../helpers/workspace-files.ts';
import type { FixTransform } from '../pipeline.ts';
import type { Fix } from '../types.ts';

const SETTER_NAMES = ['setCustomElementsManifest', 'setCustomElements'] as const;
const WEB_COMPONENTS_PACKAGES = new Set([
  '@storybook/web-components',
  '@storybook/web-components-vite',
]);
const AUTOMIGRATE_COMMAND = 'storybook automigrate web-components-runtime-manifest';
const MAX_STATEMENT_LENGTH = 80;

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
  logger.warn(dedent`
    Left the ${setterName}() call in ${previewConfigPath} alone: ${path} is not a readable Custom Elements Manifest.
    Generate one with @custom-elements-manifest/analyzer, then rerun "${AUTOMIGRATE_COMMAND}".
  `);

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
  logger.warn(dedent`
    Left the ${setterName} wiring in ${previewConfigPath} alone: ${reason}.
    Remove the runtime call by hand when convenient.
  `);

const printStatement = (node: t.Statement): string => {
  const [firstLine] = generate(node, { comments: false }).code.split('\n');
  const line = firstLine.replace(/;$/, '');
  return line.length > MAX_STATEMENT_LENGTH ? `${line.slice(0, MAX_STATEMENT_LENGTH)}...` : line;
};

const logSurvivingManifestImport = (
  previewConfigPath: string,
  specifier: string,
  readers: t.Statement[]
): void =>
  logger.warn(dedent`
    ${previewConfigPath} still imports ${specifier} for: ${readers.map((node) => `\`${printStatement(node)}\``).join(', ')}.
    Docs now read the manifest from disk, so changes made to it in the preview no longer apply, and the import makes the preview build fail when the manifest is invalid.
    Move manifest transforms into your manifest generator (for example an analyzer plugin), then remove the import.
  `);

const removePreviewWiring = (
  preview: ConfigFile,
  previewConfigPath: string,
  setterNames: SetterName[]
): void => {
  const { program } = preview._ast;
  const keptImports = new Map<string, string>();
  for (const setterName of setterNames) {
    const result = removeTopLevelCall(program, {
      callee: setterName,
      calleeSources: WEB_COMPONENTS_PACKAGES,
    });
    if (!result.removed) {
      logManualRemovalHint(previewConfigPath, setterName, result.reason);
      continue;
    }
    logger.debug(`Removed the ${setterName} wiring from ${previewConfigPath}`);
    for (const name of result.keptArguments) {
      const specifier = findDefaultJsonImportSpecifier(program, name);
      if (specifier) {
        keptImports.set(name, specifier);
      }
    }
  }

  for (const [name, specifier] of keptImports) {
    // A setter call left in place already got the manual-removal hint.
    const readers = topLevelReaders(program, name).filter(
      (node) => !SETTER_NAMES.some((setterName) => isTopLevelCall(node, setterName))
    );
    if (readers.length > 0) {
      logSurvivingManifestImport(previewConfigPath, specifier, readers);
    }
  }
};
