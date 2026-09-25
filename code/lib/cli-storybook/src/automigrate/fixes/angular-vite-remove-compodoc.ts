import { babelParse, traverse, types as t } from 'storybook/internal/babel';
import { editJsonText, isStorybookTarget, type JSONEditPath } from 'storybook/internal/cli';
import { formatFileContent, type JsPackageManager } from 'storybook/internal/common';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { existsSync } from 'node:fs';

import { dirname } from 'pathe';
import { dedent } from 'ts-dedent';

import type { FixFiles } from '../fix-files.ts';
import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import type { Fix, RunOptions } from '../types.ts';
import { findWorkspaceFiles, getTargetGroups } from './angular-workspace.ts';

export const COMPODOC_PACKAGE = '@compodoc/compodoc';
const SET_COMPODOC_JSON = 'setCompodocJson';
const ADDON_DOCS_ANGULAR = '@storybook/addon-docs/angular';
const ANGULAR_VITE_PACKAGE = '@storybook/angular-vite';

/** A workspace JSON file and the exact option paths to delete from it. */
export interface WorkspaceJsonEdit {
  filePath: string;
  optionPaths: JSONEditPath[];
}

/** A package.json script that runs the Compodoc binary, keyed by the file that declares it. */
export interface CompodocScript {
  packageJsonPath: string;
  scriptName: string;
}

export interface AngularViteRemoveCompodocOptions {
  hasFrameworkOptions: boolean;
  hasPreviewWiring: boolean;
  workspaceJsonEdits: WorkspaceJsonEdit[];
  compodocScripts: CompodocScript[];
  hasCompodocDependency: boolean;
}

const COMPODOC_OPTIONS = ['compodoc', 'compodocArgs'] as const;

/**
 * Compodoc options live under `options` and under every named `configurations` entry. Both are
 * builder options, and the shipped schemas declare `additionalProperties: false`, so a key left in
 * a configuration fails Architect validation rather than being ignored.
 */
const optionPathsOf = (prefix: JSONEditPath, targetName: string, target: any): JSONEditPath[] => {
  const pathsIn = (containerPath: JSONEditPath, options: any): JSONEditPath[] =>
    options && typeof options === 'object'
      ? COMPODOC_OPTIONS.filter((option) => option in options).map((option) => [
          ...containerPath,
          option,
        ])
      : [];

  return [
    ...pathsIn([...prefix, targetName, 'options'], target?.options),
    ...Object.entries<any>(target?.configurations ?? {}).flatMap(([name, options]) =>
      pathsIn([...prefix, targetName, 'configurations', name], options)
    ),
  ];
};

const isOwnedBy = (target: unknown, builderPackages: string[]): boolean =>
  builderPackages.some((builderPackage) => isStorybookTarget(target, builderPackage));

/**
 * Every Storybook target a document declares, including through `targetDefaults`: an Nx default
 * keyed by an executor reference names its package just as a concrete target does.
 */
const declaredStorybookTargets = (json: any): unknown[] => [
  ...getTargetGroups(json).flatMap(({ targets }) => Object.values(targets)),
  ...Object.entries<any>(json?.targetDefaults ?? {}).flatMap(([targetName, target]) => [
    target,
    { executor: targetName },
  ]),
];

/**
 * An Nx `targetDefaults` entry keyed by a bare target name names no package, so it can only be
 * attributed by elimination. Nx can crystallize Storybook targets from a plugin, so a workspace
 * that declares none is unknown rather than safe.
 */
const ownsTargetDefault = (
  targetName: string,
  target: unknown,
  builderPackages: string[],
  everyStorybookTargetIsOwned: boolean
): boolean => {
  const keyAsRef = { executor: targetName };

  if (isStorybookTarget(target) || isStorybookTarget(keyAsRef)) {
    return isOwnedBy(target, builderPackages) || isOwnedBy(keyAsRef, builderPackages);
  }

  return everyStorybookTargetIsOwned;
};

/** Every JSON path holding a Compodoc builder option that only the owned builders would have read. */
const compodocOptionPaths = (
  json: any,
  builderPackages: string[],
  everyStorybookTargetIsOwned: boolean
): JSONEditPath[] => {
  const fromTargets = getTargetGroups(json).flatMap(({ pathPrefix, targets }) =>
    Object.entries(targets).flatMap(([targetName, target]) =>
      isOwnedBy(target, builderPackages) ? optionPathsOf(pathPrefix, targetName, target) : []
    )
  );

  const targetDefaults = json?.targetDefaults;
  const fromTargetDefaults =
    targetDefaults && typeof targetDefaults === 'object'
      ? Object.entries<any>(targetDefaults).flatMap(([targetName, target]) =>
          ownsTargetDefault(targetName, target, builderPackages, everyStorybookTargetIsOwned)
            ? optionPathsOf(['targetDefaults'], targetName, target)
            : []
        )
      : [];

  return [...fromTargets, ...fromTargetDefaults];
};

const readJson = async (files: FixFiles, filePath: string): Promise<any | null> => {
  try {
    return JSON.parse(await files.read(filePath));
  } catch {
    return null;
  }
};

const DOCUMENTATION_JSON = /(^|[/\\])documentation\.json$/;

const isModuleSource = (literal: t.StringLiteral, parent: t.Node): boolean =>
  t.isImportDeclaration(parent) ||
  t.isExportNamedDeclaration(parent) ||
  t.isExportAllDeclaration(parent) ||
  (t.isCallExpression(parent) &&
    parent.arguments[0] === literal &&
    (t.isImport(parent.callee) || t.isIdentifier(parent.callee, { name: 'require' })));

/**
 * A preview counts as wired without a visible `setCompodocJson` call, which projects route through
 * an imported helper. The `documentation.json` import alone keeps a multi-megabyte payload in the
 * bundle.
 *
 * Both markers are ordinary words in a comment or a string, so they are read off the syntax tree
 * rather than the source text.
 */
const previewWiresCompodoc = (source: string): boolean => {
  let wired = false;

  try {
    traverse(babelParse(source), {
      Identifier(path) {
        if (path.node.name === SET_COMPODOC_JSON) {
          wired = true;
          path.stop();
        }
      },
      StringLiteral(path) {
        if (DOCUMENTATION_JSON.test(path.node.value) && isModuleSource(path.node, path.parent)) {
          wired = true;
          path.stop();
        }
      },
    });
  } catch {
    return false;
  }

  return wired;
};

const SHELL_SEPARATORS = /&{1,2}|\|{1,2}|;|\n/;
/**
 * A command whose path ends in the binary name (`.cmd`/`.exe` on Windows), or points inside the
 * package, as `node …/@compodoc/compodoc/bin/index-cli.js` does.
 */
const COMPODOC_COMMAND = /(^|[/\\])compodoc(\.[a-z]+)?$|(^|[/\\])@compodoc[/\\]compodoc(?:$|[/\\])/;
// Commands that precede the command they run, so the real command is the first token after them.
const COMMAND_WRAPPERS = new Set([
  'npx',
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'bunx',
  'exec',
  'dlx',
  'run',
  'run-s',
  'run-p',
  'cross-env',
  'concurrently',
  'npm-run-all',
  'node',
]);
const stripShellQuoting = (token: string) => token.replace(/^[('"`]+/, '').replace(/[)'"`]+$/, '');

/**
 * Whether a package.json script runs the Compodoc binary, rather than merely naming a path. Erring
 * towards a match is deliberate: a miss uninstalls a binary the repo's own scripts still call.
 */
const invokesCompodoc = (script: string): boolean =>
  script.split(SHELL_SEPARATORS).some((segment) => {
    const command = segment
      .trim()
      .split(/\s+/)
      .map(stripShellQuoting)
      .find(
        (token) =>
          token && !token.startsWith('-') && !token.includes('=') && !COMMAND_WRAPPERS.has(token)
      );
    return !!command && COMPODOC_COMMAND.test(command);
  });

/**
 * Scans every package.json in the workspace, not only the ones the package manager enumerates: a
 * docs-only package holds no stories and no Storybook config, yet its script still breaks once the
 * dependency is gone.
 */
const findCompodocScripts = async (
  files: FixFiles,
  packageJsonPaths: string[]
): Promise<CompodocScript[]> => {
  const paths = new Set([...packageJsonPaths, ...(await findWorkspaceFiles('package.json'))]);
  const scripts: CompodocScript[] = [];
  for (const packageJsonPath of paths) {
    for (const [scriptName, script] of Object.entries<string>(
      (await readJson(files, packageJsonPath))?.scripts ?? {}
    )) {
      if (typeof script === 'string' && invokesCompodoc(script)) {
        scripts.push({ packageJsonPath, scriptName });
      }
    }
  }
  return scripts;
};

export const angularViteRemoveCompodoc: Fix<AngularViteRemoveCompodocOptions> = {
  id: 'angular-vite-remove-compodoc',
  link: 'https://storybook.js.org/docs/get-started/frameworks/angular-vite',

  async check({ files, mainConfig, mainConfigPath, previewConfigPath, packageManager }) {
    if (!mainConfigPath || getFrameworkPackageName(mainConfig) !== '@storybook/angular-vite') {
      return null;
    }

    // An explicit opt-out means the user still runs Compodoc, so their setup has to stay.
    if (mainConfig.features?.experimentalDocgenServer === false) {
      return null;
    }

    return findCompodocSetup({ files, mainConfig, previewConfigPath, packageManager });
  },

  prompt: () =>
    dedent`
      "@storybook/angular-vite" now extracts Angular metadata on the server, so Compodoc no longer runs.
      We'll remove the Compodoc setup that has no effect anymore.
    `,

  run: (options: RunOptions<AngularViteRemoveCompodocOptions>) => removeCompodocSetup(options),
};

/**
 * Every trace of the Compodoc setup, or `null` when the project carries none.
 *
 * Split from the fix so the angular-to-angular-vite migration can reach it: that migration switches
 * the framework mid-run, which no later fix can see, since every fix is checked against the main
 * config as it was when the run started.
 */
export const findCompodocSetup = async ({
  files,
  mainConfig,
  previewConfigPath,
  packageManager,
  builderPackages = [ANGULAR_VITE_PACKAGE],
}: {
  files: FixFiles;
  mainConfig: StorybookConfigRaw;
  previewConfigPath?: string;
  packageManager: JsPackageManager;
  /**
   * Builder packages whose Compodoc options are dead. `angular-to-angular-vite` also owns
   * `@storybook/angular`: by the time it asks, every such target has been rewritten already.
   */
  builderPackages?: string[];
}): Promise<AngularViteRemoveCompodocOptions | null> => {
  const frameworkOptions =
    typeof mainConfig.framework === 'string' ? undefined : mainConfig.framework?.options;
  const hasFrameworkOptions = !!(
    frameworkOptions &&
    ('compodoc' in frameworkOptions || 'compodocArgs' in frameworkOptions)
  );

  const hasPreviewWiring =
    !!previewConfigPath && previewWiresCompodoc(await files.read(previewConfigPath));

  const documents: { filePath: string; json: any }[] = [];
  for (const filePath of await workspaceJsonCandidates(packageManager.packageJsonPaths)) {
    const json = await readJson(files, filePath);
    if (json) {
      documents.push({ filePath, json });
    }
  }
  const declaredTargets = documents.flatMap(({ json }) => declaredStorybookTargets(json));
  const everyStorybookTargetIsOwned =
    declaredTargets.some((target) => isOwnedBy(target, builderPackages)) &&
    !declaredTargets.some(
      (target) => isStorybookTarget(target) && !isOwnedBy(target, builderPackages)
    );

  const workspaceJsonEdits = documents
    .map(({ filePath, json }) => ({
      filePath,
      optionPaths: compodocOptionPaths(json, builderPackages, everyStorybookTargetIsOwned),
    }))
    .filter(({ optionPaths }) => optionPaths.length > 0);

  const hasCompodocDependency = !!(await packageManager.getDependencyVersion(COMPODOC_PACKAGE));

  if (
    !hasFrameworkOptions &&
    !hasPreviewWiring &&
    workspaceJsonEdits.length === 0 &&
    !hasCompodocDependency
  ) {
    return null;
  }

  return {
    hasFrameworkOptions,
    hasPreviewWiring,
    workspaceJsonEdits,
    compodocScripts: await findCompodocScripts(files, packageManager.packageJsonPaths),
    hasCompodocDependency,
  };
};

/** Deletes what {@link findCompodocSetup} reported, wherever it lives. */
export const removeCompodocSetup = async ({
  result,
  files,
  mainConfigPath,
  previewConfigPath,
  packageManager,
}: {
  result: AngularViteRemoveCompodocOptions;
  files: FixFiles;
  mainConfigPath: string;
  previewConfigPath?: string;
  packageManager: JsPackageManager;
}): Promise<void> => {
  const {
    hasFrameworkOptions,
    hasPreviewWiring,
    workspaceJsonEdits,
    compodocScripts,
    hasCompodocDependency,
  } = result;

  if (hasFrameworkOptions) {
    await files.editConfig(mainConfigPath, (main) => {
      main.remove(['framework', 'options', 'compodoc']);
      main.remove(['framework', 'options', 'compodocArgs']);
    });
    logger.step(`Removed the Compodoc framework options from ${mainConfigPath}`);
  }

  if (hasPreviewWiring && previewConfigPath) {
    await removePreviewWiring(files, previewConfigPath);
  }

  for (const { filePath, optionPaths } of workspaceJsonEdits) {
    await removeCompodocOptions(files, filePath, optionPaths);
  }

  if (hasCompodocDependency) {
    if (compodocScripts.length > 0) {
      const scripts = compodocScripts
        .map(({ packageJsonPath, scriptName }) => `"${scriptName}" in ${packageJsonPath}`)
        .join(', ');
      logger.warn(
        `Kept ${COMPODOC_PACKAGE}: ${scripts} still run it. Storybook no longer needs Compodoc, ` +
          `so remove the dependency once your own scripts stop calling it.`
      );
    } else {
      await packageManager.removeDependencies([COMPODOC_PACKAGE]);
      logger.step(`Removed ${COMPODOC_PACKAGE}`);
      await removeCompodocOverrides(files, packageManager);
    }
  }
};

/** npm/bun, yarn and pnpm each declare version pins under a different key. */
const OVERRIDE_CONTAINERS = [['overrides'], ['resolutions'], ['pnpm', 'overrides']] as const;

/**
 * Drops version pins for a dependency nothing depends on anymore.
 *
 * The edit goes through the package manager rather than `node:fs`: `JsPackageManager` reads
 * package.json through a process-wide cache that no raw write invalidates, so every later
 * `addDependencies`/`removeDependencies` would serialise the pre-edit snapshot back over the file.
 */
const removeCompodocOverrides = async (
  files: FixFiles,
  packageManager: JsPackageManager
): Promise<void> => {
  for (const packageJsonPath of packageManager.packageJsonPaths) {
    const json = await readJson(files, packageJsonPath);
    const containers = OVERRIDE_CONTAINERS.map((path) =>
      path.reduce<any>((parent, key) => parent?.[key], json)
    ).filter((container) => container && COMPODOC_PACKAGE in container);

    if (containers.length === 0) {
      continue;
    }

    containers.forEach((container) => delete container[COMPODOC_PACKAGE]);
    packageManager.writePackageJson(json, dirname(packageJsonPath));
    logger.step(`Removed the dangling ${COMPODOC_PACKAGE} override from ${packageJsonPath}`);
  }
};

const manualRemovalHint = (previewConfigPath: string, reason: string) =>
  logger.warn(
    `Left the Compodoc wiring in ${previewConfigPath} alone: ${reason}. ` +
      `Compodoc has no effect anymore, so remove what is left there by hand when convenient: ` +
      `a documentation.json import on its own still ships in your bundle.`
  );

/** Counts how often a binding is still read, so an import is only dropped once nothing needs it. */
const countReferences = (program: t.Program, name: string): number => {
  let references = 0;
  traverse(t.file(program), {
    Identifier(path) {
      if (path.node.name !== name || path.parentPath?.isImportDefaultSpecifier()) {
        return;
      }
      if (path.isReferencedIdentifier()) {
        references += 1;
      }
    },
  });
  return references;
};

/**
 * Strips the top-level `setCompodocJson` call and the imports that exist only to feed it.
 *
 * Real previews wrap the call in a helper or pre-process the JSON before handing it over
 * (`vmware-clarity/ng-clarity` does both). Rewriting those safely is not worth the risk, so
 * anything that is not a plain top-level call is reported and left untouched. Imports survive
 * while any other code still reads them.
 */
const removePreviewWiring = async (files: FixFiles, previewConfigPath: string): Promise<void> => {
  const changed = await files.edit(previewConfigPath, async (source) => {
    const preview = loadConfig(source, previewConfigPath).parse();
    const program = preview._ast.program;

    const callsToDrop = program.body.filter(
      (node) =>
        t.isExpressionStatement(node) &&
        t.isCallExpression(node.expression) &&
        t.isIdentifier(node.expression.callee, { name: SET_COMPODOC_JSON })
    );

    if (callsToDrop.length === 0) {
      manualRemovalHint(
        previewConfigPath,
        countReferences(program, SET_COMPODOC_JSON) > 0
          ? `${SET_COMPODOC_JSON} is not called at the top level`
          : `no ${SET_COMPODOC_JSON} call is visible here, only a documentation.json import`
      );
      return;
    }

    const withoutCalls = t.program(program.body.filter((node) => !callsToDrop.includes(node)));
    if (countReferences(withoutCalls, SET_COMPODOC_JSON) > 0) {
      manualRemovalHint(previewConfigPath, `${SET_COMPODOC_JSON} is still used elsewhere`);
      return;
    }

    const droppableImportNames = new Set(
      callsToDrop.flatMap((node) => {
        const [argument] = ((node as t.ExpressionStatement).expression as t.CallExpression)
          .arguments;
        return t.isIdentifier(argument) && countReferences(withoutCalls, argument.name) === 0
          ? [argument.name]
          : [];
      })
    );

    const isDroppableSpecifier = (
      declaration: t.ImportDeclaration,
      specifier: t.ImportDeclaration['specifiers'][number]
    ) =>
      declaration.source.value === ADDON_DOCS_ANGULAR
        ? specifier.local.name === SET_COMPODOC_JSON
        : droppableImportNames.has(specifier.local.name);

    const remaining: t.Statement[] = [];
    for (const node of withoutCalls.body) {
      // A declaration without specifiers is imported for its side effects, so it stays as it is.
      if (t.isImportDeclaration(node) && node.specifiers.length > 0) {
        node.specifiers = node.specifiers.filter(
          (specifier) => !isDroppableSpecifier(node, specifier)
        );
        if (node.specifiers.length === 0) {
          continue;
        }
      }
      remaining.push(node);
    }

    program.body = remaining;
    return formatFileContent(previewConfigPath, formatConfig(preview));
  });
  if (changed.length > 0) {
    logger.step(`Removed the ${SET_COMPODOC_JSON} wiring from ${previewConfigPath}`);
  }
};

/**
 * `angular.json` and `nx.json` beside each package.json, plus every Nx `project.json`.
 *
 * Nx scatters `project.json` files (one per library) away from any package.json, so they have
 * to be globbed rather than derived, the same way the angular-to-angular-vite migration finds them.
 */
const workspaceJsonCandidates = async (packageJsonPaths: string[]): Promise<string[]> => {
  const siblingPaths = packageJsonPaths
    .flatMap((pkgJsonPath) =>
      ['angular.json', 'nx.json'].map((name) =>
        pkgJsonPath.replace(/[/\\]package\.json$/, `/${name}`)
      )
    )
    .filter((path) => existsSync(path));

  return [...siblingPaths, ...(await findWorkspaceFiles('project.json'))];
};

/** Drops the `compodoc` and `compodocArgs` builder options, which angular-vite never read. */
const removeCompodocOptions = async (
  files: FixFiles,
  workspaceJsonPath: string,
  optionPaths: JSONEditPath[]
): Promise<void> => {
  const changed = await files.edit(workspaceJsonPath, (source) =>
    optionPaths.reduce((text, path) => editJsonText(text, path, undefined), source)
  );
  if (changed.length > 0) {
    logger.step(`Removed the Compodoc builder options from ${workspaceJsonPath}`);
  }
};
