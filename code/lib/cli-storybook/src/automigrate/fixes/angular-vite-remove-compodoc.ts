import { writeFile } from 'node:fs/promises';

import { traverse, types as t } from 'storybook/internal/babel';
import { AngularJSON, isStorybookTarget } from 'storybook/internal/cli';
import { formatFileContent } from 'storybook/internal/common';
import { formatConfig, readConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import { existsSync, readFileSync } from 'node:fs';

import { dedent } from 'ts-dedent';

import { getFrameworkPackageName, updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { Fix, RunOptions } from '../types.ts';

export const COMPODOC_PACKAGE = '@compodoc/compodoc';
const SET_COMPODOC_JSON = 'setCompodocJson';
const ADDON_DOCS_ANGULAR = '@storybook/addon-docs/angular';

interface AngularViteRemoveCompodocOptions {
  hasFrameworkOptions: boolean;
  hasPreviewWiring: boolean;
  angularJsonPaths: string[];
  hasCompodocDependency: boolean;
}

/** Storybook targets in `angular.json` that still carry the never-read Compodoc builder options. */
const angularJsonPathsWithCompodoc = (packageJsonPaths: string[]): string[] =>
  packageJsonPaths
    .map((pkgJsonPath) => pkgJsonPath.replace(/[/\\]package\.json$/, '/angular.json'))
    .filter((angularJsonPath) => {
      if (!existsSync(angularJsonPath)) {
        return false;
      }
      try {
        const { projects } = JSON.parse(readFileSync(angularJsonPath, 'utf8')) ?? {};
        return Object.values(projects ?? {}).some((project: any) =>
          Object.values(project?.architect ?? project?.targets ?? {}).some(
            (target: any) =>
              isStorybookTarget(target) &&
              target.options &&
              ('compodoc' in target.options || 'compodocArgs' in target.options)
          )
        );
      } catch {
        return false;
      }
    });

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

    const angularJsonPaths = angularJsonPathsWithCompodoc(packageManager.packageJsonPaths);

    const hasCompodocDependency = !!(await packageManager.getDependencyVersion(COMPODOC_PACKAGE));

    if (
      !hasFrameworkOptions &&
      !hasPreviewWiring &&
      angularJsonPaths.length === 0 &&
      !hasCompodocDependency
    ) {
      return null;
    }

    return { hasFrameworkOptions, hasPreviewWiring, angularJsonPaths, hasCompodocDependency };
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
  }: RunOptions<AngularViteRemoveCompodocOptions>) => {
    const { hasFrameworkOptions, hasPreviewWiring, angularJsonPaths, hasCompodocDependency } =
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

    for (const angularJsonPath of angularJsonPaths) {
      removeAngularJsonCompodocOptions(angularJsonPath, dryRun);
    }

    if (hasCompodocDependency && !dryRun) {
      await packageManager.removeDependencies([COMPODOC_PACKAGE]);
      logger.step(`Removed ${COMPODOC_PACKAGE}`);
    }
  },
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

    const remaining = withoutCalls.body.filter((node) => {
      if (!t.isImportDeclaration(node)) {
        return true;
      }
      if (node.source.value === ADDON_DOCS_ANGULAR) {
        return node.specifiers.length > 1;
      }
      return !node.specifiers.some(
        (specifier) =>
          t.isImportDefaultSpecifier(specifier) && droppableImportNames.has(specifier.local.name)
      );
    });

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

/** Drops the `compodoc` and `compodocArgs` builder options, which angular-vite never read. */
const removeAngularJsonCompodocOptions = (angularJsonPath: string, dryRun: boolean): void => {
  try {
    const angularJson = new AngularJSON(angularJsonPath);
    let changed = false;

    for (const [projectName, project] of Object.entries(angularJson.projects ?? {})) {
      const targets = (project as any)?.architect ?? (project as any)?.targets ?? {};
      for (const [targetName, target] of Object.entries<any>(targets)) {
        if (!isStorybookTarget(target) || !target.options) {
          continue;
        }
        for (const option of ['compodoc', 'compodocArgs']) {
          if (option in target.options) {
            angularJson.edit(
              ['projects', projectName, 'architect', targetName, 'options', option],
              undefined
            );
            changed = true;
          }
        }
      }
    }

    if (changed && !dryRun) {
      angularJson.write();
      logger.step(`Removed the Compodoc builder options from ${angularJsonPath}`);
    }
  } catch (error) {
    logger.warn(
      `Could not remove the Compodoc builder options from ${angularJsonPath} automatically: ${error}.`
    );
  }
};
