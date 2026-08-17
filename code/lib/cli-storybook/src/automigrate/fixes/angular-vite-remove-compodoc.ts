import { writeFile } from 'node:fs/promises';

import { traverse, types as t } from 'storybook/internal/babel';
import { editJsonText, isStorybookTarget, type JSONEditPath } from 'storybook/internal/cli';
import { formatFileContent, type JsPackageManager } from 'storybook/internal/common';
import { formatConfig, readConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { dedent } from 'ts-dedent';

import { getFrameworkPackageName, updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { Fix, RunOptions } from '../types.ts';

export const COMPODOC_PACKAGE = '@compodoc/compodoc';
const SET_COMPODOC_JSON = 'setCompodocJson';
const ADDON_DOCS_ANGULAR = '@storybook/addon-docs/angular';

export interface AngularViteRemoveCompodocOptions {
  hasFrameworkOptions: boolean;
  hasPreviewWiring: boolean;
  workspaceJsonPaths: string[];
  hasCompodocDependency: boolean;
}

const COMPODOC_OPTIONS = ['compodoc', 'compodocArgs'] as const;

/**
 * Every JSON path holding a Compodoc builder option, across both workspace layouts.
 *
 * `angular.json` nests targets under `projects.<name>.architect`; an Nx `project.json` is one
 * project with its targets at the root. The option names and the Storybook target check are the
 * same either way, so both shapes reduce to the same list of paths to delete.
 */
const compodocOptionPaths = (json: any): JSONEditPath[] => {
  const groups: { prefix: JSONEditPath; targets: Record<string, unknown> }[] = [];
  for (const [name, project] of Object.entries<any>(json?.projects ?? {})) {
    for (const key of ['architect', 'targets'] as const) {
      if (project?.[key] && typeof project[key] === 'object') {
        groups.push({ prefix: ['projects', name, key], targets: project[key] });
      }
    }
  }

  if (json?.targets && typeof json.targets === 'object') {
    groups.push({ prefix: ['targets'], targets: json.targets });
  }

  return groups.flatMap(({ prefix, targets }) =>
    Object.entries(targets).flatMap(([targetName, target]: [string, any]) => {
      const options = isStorybookTarget(target) ? target.options : undefined;
      return options
        ? COMPODOC_OPTIONS.filter((option) => option in options).map((option) => [
            ...prefix,
            targetName,
            'options',
            option,
          ])
        : [];
    })
  );
};

const hasCompodocOptions = (filePath: string): boolean => {
  try {
    return compodocOptionPaths(JSON.parse(readFileSync(filePath, 'utf8'))).length > 0;
  } catch {
    return false;
  }
};

const previewCallsSetCompodocJson = (source: string): boolean => source.includes(SET_COMPODOC_JSON);

export const angularViteRemoveCompodoc: Fix<AngularViteRemoveCompodocOptions> = {
  id: 'angular-vite-remove-compodoc',
  link: 'https://storybook.js.org/docs/get-started/frameworks/angular-vite',

  async check({ mainConfig, mainConfigPath, previewConfigPath, packageManager }) {
    if (!mainConfigPath || getFrameworkPackageName(mainConfig) !== '@storybook/angular-vite') {
      return null;
    }

    // An explicit opt-out means the user still runs Compodoc, so their setup has to stay.
    if (mainConfig.features?.experimentalDocgenServer === false) {
      return null;
    }

    return findCompodocSetup({ mainConfig, previewConfigPath, packageManager });
  },

  prompt: () =>
    dedent`
      "@storybook/angular-vite" now extracts Angular metadata on the server, so Compodoc no longer runs.
      We'll remove the Compodoc setup that has no effect anymore.
    `,

  run: async ({
    result,
    dryRun = false,
    mainConfigPath,
    previewConfigPath,
    packageManager,
  }: RunOptions<AngularViteRemoveCompodocOptions>) =>
    removeCompodocSetup({ result, dryRun, mainConfigPath, previewConfigPath, packageManager }),
};

/**
 * Every trace of the Compodoc setup, or `null` when the project carries none.
 *
 * Split from the fix so the angular-to-angular-vite migration can reach it: that migration switches
 * the framework mid-run, which no later fix can see, since every fix is checked against the main
 * config as it was when the run started.
 */
export const findCompodocSetup = async ({
  mainConfig,
  previewConfigPath,
  packageManager,
}: {
  mainConfig: StorybookConfigRaw;
  previewConfigPath?: string;
  packageManager: JsPackageManager;
}): Promise<AngularViteRemoveCompodocOptions | null> => {
  const frameworkOptions =
    typeof mainConfig.framework === 'string' ? undefined : mainConfig.framework?.options;
  const hasFrameworkOptions = !!(
    frameworkOptions &&
    ('compodoc' in frameworkOptions || 'compodocArgs' in frameworkOptions)
  );

  const hasPreviewWiring =
    !!previewConfigPath &&
    existsSync(previewConfigPath) &&
    previewCallsSetCompodocJson(readFileSync(previewConfigPath, 'utf8'));

  const workspaceJsonPaths = (
    await workspaceJsonCandidates(packageManager.packageJsonPaths)
  ).filter(hasCompodocOptions);

  const hasCompodocDependency = !!(await packageManager.getDependencyVersion(COMPODOC_PACKAGE));

  if (
    !hasFrameworkOptions &&
    !hasPreviewWiring &&
    workspaceJsonPaths.length === 0 &&
    !hasCompodocDependency
  ) {
    return null;
  }

  return { hasFrameworkOptions, hasPreviewWiring, workspaceJsonPaths, hasCompodocDependency };
};

/** Deletes what {@link findCompodocSetup} reported, wherever it lives. */
export const removeCompodocSetup = async ({
  result,
  dryRun,
  mainConfigPath,
  previewConfigPath,
  packageManager,
}: {
  result: AngularViteRemoveCompodocOptions;
  dryRun: boolean;
  mainConfigPath: string;
  previewConfigPath?: string;
  packageManager: JsPackageManager;
}): Promise<void> => {
  const { hasFrameworkOptions, hasPreviewWiring, workspaceJsonPaths, hasCompodocDependency } =
    result;

  if (hasFrameworkOptions) {
    await updateMainConfig({ mainConfigPath, dryRun }, (main) => {
      main.removeField(['framework', 'options', 'compodoc']);
      main.removeField(['framework', 'options', 'compodocArgs']);
    });
    logger.step(`Removed the Compodoc framework options from ${mainConfigPath}`);
  }

  if (hasPreviewWiring && previewConfigPath) {
    await removePreviewWiring(previewConfigPath, dryRun);
  }

  for (const workspaceJsonPath of workspaceJsonPaths) {
    removeCompodocOptions(workspaceJsonPath, dryRun);
  }

  if (hasCompodocDependency && !dryRun) {
    await packageManager.removeDependencies([COMPODOC_PACKAGE]);
    logger.step(`Removed ${COMPODOC_PACKAGE}`);
  }
};

const manualRemovalHint = (previewConfigPath: string, reason: string) =>
  logger.warn(
    `Left the ${SET_COMPODOC_JSON} wiring in ${previewConfigPath} alone: ${reason}. ` +
      `It has no effect anymore, so delete the call and the documentation.json import when convenient.`
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
const removePreviewWiring = async (previewConfigPath: string, dryRun: boolean): Promise<void> => {
  try {
    const preview = await readConfig(previewConfigPath);
    const program = preview._ast.program;

    const callsToDrop = program.body.filter(
      (node) =>
        t.isExpressionStatement(node) &&
        t.isCallExpression(node.expression) &&
        t.isIdentifier(node.expression.callee, { name: SET_COMPODOC_JSON })
    );

    if (callsToDrop.length === 0) {
      manualRemovalHint(previewConfigPath, `${SET_COMPODOC_JSON} is not called at the top level`);
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

    if (dryRun) {
      return;
    }

    program.body = remaining;
    await writeFile(
      previewConfigPath,
      await formatFileContent(previewConfigPath, formatConfig(preview))
    );
    logger.step(`Removed the ${SET_COMPODOC_JSON} wiring from ${previewConfigPath}`);
  } catch (error) {
    manualRemovalHint(previewConfigPath, `it could not be rewritten automatically (${error})`);
  }
};

/**
 * `angular.json` beside each package.json, plus every Nx `project.json` in the workspace.
 *
 * Nx scatters `project.json` files (one per library) away from any package.json, so they have
 * to be globbed rather than derived, the same way the angular-to-angular-vite migration finds them.
 */
const workspaceJsonCandidates = async (packageJsonPaths: string[]): Promise<string[]> => {
  const angularJsonPaths = packageJsonPaths
    .map((pkgJsonPath) => pkgJsonPath.replace(/[/\\]package\.json$/, '/angular.json'))
    .filter((path) => existsSync(path));

  // eslint-disable-next-line depend/ban-dependencies
  const { globby } = await import('globby');
  const projectJsonPaths = await globby(['**/project.json'], {
    ignore: ['**/node_modules/**', '**/dist/**'],
    absolute: true,
  });

  return [...angularJsonPaths, ...projectJsonPaths];
};

/** Drops the `compodoc` and `compodocArgs` builder options, which angular-vite never read. */
const removeCompodocOptions = (workspaceJsonPath: string, dryRun: boolean): void => {
  try {
    const original = readFileSync(workspaceJsonPath, 'utf8');
    const paths = compodocOptionPaths(JSON.parse(original));
    if (paths.length === 0) {
      return;
    }

    const updated = paths.reduce(
      (text, path) => editJsonText(text, path, undefined),
      original as string
    );

    if (!dryRun && updated !== original) {
      writeFileSync(workspaceJsonPath, updated);
      logger.step(`Removed the Compodoc builder options from ${workspaceJsonPath}`);
    }
  } catch (error) {
    logger.warn(
      `Could not remove the Compodoc builder options from ${workspaceJsonPath} automatically: ${error}.`
    );
  }
};
