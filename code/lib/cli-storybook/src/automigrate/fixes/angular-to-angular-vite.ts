import { readFile, writeFile } from 'node:fs/promises';

import { types as t } from 'storybook/internal/babel';
import {
  ANALOG_VITE_PLUGIN_ANGULAR_VERSION,
  AngularJSON,
  editJsonText,
  isStorybookTarget,
  type JSONEditPath,
  type StorybookBuilderTarget,
  toDevkitVersion,
} from 'storybook/internal/cli';
import { formatFileContent, getProjectRoot, transformImportFiles } from 'storybook/internal/common';
import { formatConfig, readConfig } from 'storybook/internal/csf-tools';
import { logger, prompt } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';
import { dirname, relative, resolve } from 'pathe';
import semver from 'semver';
import { dedent } from 'ts-dedent';

import { add } from '../../add.ts';
import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';
import {
  findWorkspaceFiles,
  getTargetGroups,
  type AngularTargetGroup,
} from './angular-workspace.ts';
import { findCompodocSetup, removeCompodocSetup } from './angular-vite-remove-compodoc.ts';

export const ANGULAR_PACKAGE = '@storybook/angular';
export const ANALOG_PACKAGE = '@analogjs/storybook-angular';
export const ANGULAR_VITE_PACKAGE = '@storybook/angular-vite';
const ANALOG_VITE_PLUGIN_PACKAGE = '@analogjs/vite-plugin-angular';

const ANGULAR_BUILD_PACKAGE = '@angular/build';
const ANGULAR_ANIMATIONS_PACKAGE = '@angular/animations';
const ANGULAR_DEVKIT_ARCHITECT_PACKAGE = '@angular-devkit/architect';

const MIGRATABLE_FRAMEWORKS = [ANGULAR_PACKAGE, ANALOG_PACKAGE] as const;
type MigratableFramework = (typeof MIGRATABLE_FRAMEWORKS)[number];

const FRAMEWORK_DOC_URL = 'https://storybook.js.org/docs/get-started/frameworks/angular-vite';
const VITE_CONFIG_DOC_URL = 'https://storybook.js.org/docs/builders/vite#configure';

const ANGULAR_MIN_MAJOR = 21;

interface AngularToAngularViteOptions {
  /** The framework the project renders with today, and the one every rewrite below keys off. */
  framework: MigratableFramework;
  angularVersion: string | null;
  /** True when the main config contains a webpackFinal hook. */
  hasWebpackFinal: boolean;
  /** package.json paths that reference @storybook/angular. */
  packageJsonFiles: string[];
}

/**
 * Replace @storybook/angular builder references in a JSON file. Handles both
 * `angular.json` architect entries and `package.json` scripts.
 */
const rewriteBuilderRefs = (content: string): string =>
  MIGRATABLE_FRAMEWORKS.reduce(
    (acc, framework) =>
      acc
        .replaceAll(`${framework}:start-storybook`, `${ANGULAR_VITE_PACKAGE}:start-storybook`)
        .replaceAll(`${framework}:build-storybook`, `${ANGULAR_VITE_PACKAGE}:build-storybook`),
    content
  );

/**
 * Repoint an existing `test-storybook` package.json script at standalone Vitest. The
 * @storybook/test-runner flow does not carry over to @storybook/angular-vite, so the script should
 * run `vitest run` directly. No-ops when the script is absent, and is idempotent (rewriting an
 * already-`vitest run` value yields the same string).
 */
const rewriteTestStorybookScript = (content: string): string =>
  content.replace(/("test-storybook"\s*:\s*)"(?:[^"\\]|\\.)*"/, '$1"vitest run"');

// Config file basenames whose presence means a Vite/Vitest setup already exists, so the migration
// must not write a fresh `vitest.config.ts` over it — the deferred addon-vitest postinstall
// updates the existing file instead.
const VITE_CONFIG_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.cts', '.mts', '.cjs', '.mjs'];

/**
 * Find an existing Vite/Vitest config by searching from the Storybook config dir up to the project
 * root, mirroring the addon-vitest postinstall's lookup. Returns the first match, or `undefined`
 * when none exists.
 */
const findExistingViteConfig = (configDir: string): string | undefined => {
  const search = (basename: string, extensions: string[]) =>
    find.any(
      extensions.map((ext) => basename + ext),
      { last: getProjectRoot(), cwd: configDir }
    );

  return (
    search('vite.config', VITE_CONFIG_EXTENSIONS) || search('vitest.config', VITE_CONFIG_EXTENSIONS)
  );
};

/**
 * A standalone `vitest.config.ts` for Angular projects. The nested `plugins` array carries
 * `storybookAngularVitest()` ahead of `storybookTest()` so standalone `vitest` runs receive the
 * Angular build options (styles, assets, zoneless, …) — both must live in the same array.
 * `configDirRelative` is the path from this file's directory to the Storybook config dir.
 */
const buildAngularVitestConfig = (
  configDirRelative: string
): string => `import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { storybookAngularVitest } from '@storybook/angular-vite/vitest';

import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          // Forwards Angular build options (styles, assets, zoneless, …) into standalone vitest runs
          storybookAngularVitest({}),
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, '${configDirRelative}') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
`;

const transformMainConfig = async (
  mainConfigPath: string,
  dryRun: boolean,
  framework: MigratableFramework
): Promise<boolean> => {
  try {
    const content = await readFile(mainConfigPath, 'utf-8');

    if (!content.includes(framework)) {
      return false;
    }

    // Only `@storybook/angular` is a prefix of `@storybook/angular-vite`, so only it needs the
    // negative lookahead that leaves already-migrated references alone.
    const transformed =
      framework === ANGULAR_PACKAGE
        ? content.replace(/@storybook\/angular(?!-vite)/g, ANGULAR_VITE_PACKAGE)
        : content.replaceAll(framework, ANGULAR_VITE_PACKAGE);

    if (transformed !== content && !dryRun) {
      await writeFile(mainConfigPath, transformed);
    }

    return transformed !== content;
  } catch (error) {
    logger.error(`Failed to update main config at ${mainConfigPath}: ${error}`);
    return false;
  }
};

interface JsonTargetTransformResult {
  changed: boolean;
  hasStorybookTarget: boolean;
  /** True when at least one storybook target explicitly declares `zoneless: false`. */
  anyZoneBasedTarget: boolean;
}

/** Map a migratable builder/executor ref to its angular-vite equivalent, or `null` if unrelated. */
const rewriteStorybookBuilderRef = (ref: string): string | null => {
  for (const framework of MIGRATABLE_FRAMEWORKS) {
    if (ref === `${framework}:start-storybook`) {
      return `${ANGULAR_VITE_PACKAGE}:start-storybook`;
    }
    if (ref === `${framework}:build-storybook`) {
      return `${ANGULAR_VITE_PACKAGE}:build-storybook`;
    }
  }
  return null;
};

/** Whether `target` runs Storybook through a framework this migration can rewrite. */
const isMigratableStorybookTarget = (target: unknown): target is StorybookBuilderTarget =>
  MIGRATABLE_FRAMEWORKS.some((framework) => isStorybookTarget(target, framework));

/**
 * Resolve what `main.ts` names as its framework to one this migration can rewrite.
 *
 * `getFrameworkPackageName` maps a resolved path back to a package name only for frameworks
 * Storybook itself ships, so a third-party one like `@analogjs/storybook-angular` arrives as
 * whatever `getAbsolutePath()` returned: the installed package directory, or a pnpm virtual-store
 * dir that spells the scope slash as `+`.
 */
const matchMigratableFramework = (
  frameworkPackageName: string | null
): MigratableFramework | undefined => {
  if (!frameworkPackageName) {
    return undefined;
  }
  const normalized = frameworkPackageName.replace(/\\/g, '/');
  return MIGRATABLE_FRAMEWORKS.find(
    (framework) =>
      normalized === framework ||
      // `@storybook/angular` must not match a path ending in `@storybook/angular-vite`, which the
      // leading slash guarantees.
      normalized.endsWith(`/${framework}`) ||
      normalized.includes(`/.pnpm/${framework.replace('/', '+')}@`)
  );
};

/** Applies a single format-preserving edit; shared by `AngularJSON` and `TextJsonEditor` below. */
interface TargetEditor {
  edit(path: JSONEditPath, value: unknown): void;
}

/** Accumulates sequential `editJsonText` edits against an in-memory string (project.json's editor). */
class TextJsonEditor implements TargetEditor {
  content: string;

  constructor(content: string) {
    this.content = content;
  }

  edit(path: JSONEditPath, value: unknown): void {
    this.content = editJsonText(this.content, path, value);
  }
}

/**
 * Rewrite builder/executor references and rename any leftover `experimentalZoneless` key to
 * `zoneless`, across every storybook target in `targetGroups`, reporting whether any of them
 * explicitly opts out of zoneless change detection.
 */
const processStorybookTargets = (
  editor: TargetEditor,
  targetGroups: AngularTargetGroup[]
): JsonTargetTransformResult => {
  let changed = false;
  let hasStorybookTarget = false;
  let anyZoneBasedTarget = false;

  for (const { pathPrefix, targets } of targetGroups) {
    for (const [targetName, target] of Object.entries(targets)) {
      // Detection is wider than the rewrite: a multi-project upgrade runs each project against the
      // tree the first project already rewrote, and a narrower gate would report no Storybook
      // target at all and skip the zone.js injection.
      if (
        !isMigratableStorybookTarget(target) &&
        !isStorybookTarget(target, ANGULAR_VITE_PACKAGE)
      ) {
        continue;
      }
      hasStorybookTarget = true;

      // Snapshot before editing: `AngularJSON.edit()` reparses `json`, invalidating `target`.
      const currentRef = target.builder ?? target.executor ?? null;
      const hasOldZonelessKey = !!target.options && 'experimentalZoneless' in target.options;
      // An earlier run may already have renamed the key, so both spellings count.
      const zonelessValue = target.options?.zoneless ?? target.options?.experimentalZoneless;

      if (zonelessValue === false) {
        anyZoneBasedTarget = true;
      }

      if (!isMigratableStorybookTarget(target)) {
        continue;
      }

      const newRef = currentRef ? rewriteStorybookBuilderRef(currentRef) : null;
      if (newRef) {
        const refKey = 'builder' in target ? 'builder' : 'executor';
        editor.edit([...pathPrefix, targetName, refKey], newRef);
        changed = true;
      }

      if (hasOldZonelessKey) {
        editor.edit([...pathPrefix, targetName, 'options', 'zoneless'], zonelessValue);
        editor.edit([...pathPrefix, targetName, 'options', 'experimentalZoneless'], undefined);
        changed = true;
      }
    }
  }

  return { changed, hasStorybookTarget, anyZoneBasedTarget };
};

const transformAngularJson = (
  angularJsonPath: string,
  dryRun: boolean
): JsonTargetTransformResult => {
  let angularJSON: AngularJSON;
  try {
    angularJSON = new AngularJSON(angularJsonPath);
  } catch {
    return {
      changed: false,
      hasStorybookTarget: false,
      anyZoneBasedTarget: false,
    };
  }

  const result = processStorybookTargets(angularJSON, getTargetGroups(angularJSON.json));

  if (result.changed && !dryRun) {
    angularJSON.write();
  }

  return result;
};

/**
 * Same as `transformAngularJson`, for Nx `project.json` files: a flat `targets` object with no
 * `projects.<name>` nesting, so it doesn't fit `AngularJSON`'s model.
 */
const transformProjectJson = async (
  projectJsonPath: string,
  dryRun: boolean
): Promise<JsonTargetTransformResult> => {
  try {
    const original = await readFile(projectJsonPath, 'utf-8');
    const json = JSON.parse(original);
    const editor = new TextJsonEditor(original);
    const result = processStorybookTargets(editor, getTargetGroups(json));

    if (result.changed && !dryRun) {
      await writeFile(projectJsonPath, editor.content);
    }

    return result;
  } catch {
    return {
      changed: false,
      hasStorybookTarget: false,
      anyZoneBasedTarget: false,
    };
  }
};

const addZoneJsPreviewImport = async (
  previewConfigPath: string,
  dryRun: boolean
): Promise<void> => {
  try {
    const preview = await readConfig(previewConfigPath);

    // Leave an existing zone.js import (incl. subpaths like zone.js/testing) alone.
    const hasZoneJsImport = preview._ast.program.body.some(
      (node) =>
        t.isImportDeclaration(node) &&
        typeof node.source.value === 'string' &&
        (node.source.value === 'zone.js' || node.source.value.startsWith('zone.js/'))
    );
    if (hasZoneJsImport || dryRun) {
      return;
    }

    preview.setImport(null, 'zone.js');
    const formatted = await formatFileContent(previewConfigPath, formatConfig(preview));
    await writeFile(previewConfigPath, formatted);
    logger.step(`Added a \`zone.js\` import to ${previewConfigPath}`);
  } catch (error) {
    logger.warn(
      `Could not add a \`zone.js\` import to ${previewConfigPath} automatically: ${error}. ` +
        "If your app uses zone-based change detection, add `import 'zone.js';` at the top of your preview."
    );
  }
};

const getGuaranteedAngularMajor = (specifier: string | null): number | null => {
  const range = specifier ? semver.validRange(specifier) : null;
  const major = range ? (semver.minVersion(range)?.major ?? null) : null;
  return major === 0 ? null : major;
};

export const angularToAngularVite: Fix<AngularToAngularViteOptions> = {
  id: 'angular-to-angular-vite',
  link: FRAMEWORK_DOC_URL,
  defaultSelected: false,

  async check({ packageManager, mainConfig }): Promise<AngularToAngularViteOptions | null> {
    const allDeps = packageManager.getAllDependencies();

    // Only apply when a migratable framework is present and @storybook/angular-vite is not.
    if (allDeps[ANGULAR_VITE_PACKAGE] || MIGRATABLE_FRAMEWORKS.every((pkg) => !allDeps[pkg])) {
      return null;
    }

    const angularSpecifier = await packageManager.getDeclaredVersionSpecifier('@angular/core');

    // `@analogjs/storybook-angular` declares `@storybook/angular` as its peer, so the dependency
    // alone does not say which framework the project renders with, and a framework this migration
    // cannot rewrite would come out a half-migrated hybrid. Only the `framework` field decides.
    const frameworkPackageName = getFrameworkPackageName(mainConfig);
    const framework = matchMigratableFramework(frameworkPackageName);
    if (!framework) {
      if (angularSpecifier) {
        logger.warn(
          `Skipped ${ANGULAR_VITE_PACKAGE} migration: this project's Storybook framework is ` +
            `\`${frameworkPackageName ?? 'not set'}\`, and only ` +
            `${MIGRATABLE_FRAMEWORKS.map((pkg) => `\`${pkg}\``).join(' and ')} projects can be ` +
            `migrated automatically. See ${FRAMEWORK_DOC_URL} to switch frameworks by hand.`
        );
      }
      return null;
    }

    const angularMajor = getGuaranteedAngularMajor(angularSpecifier);
    if (angularMajor !== null && angularMajor < ANGULAR_MIN_MAJOR) {
      logger.warn(
        `Skipped ${ANGULAR_VITE_PACKAGE} migration: it needs Angular ${ANGULAR_MIN_MAJOR}, and ` +
          `this project is on Angular ${angularMajor}. Run \`ng update @angular/core @angular/cli\` ` +
          `to upgrade, then run this migration again.`
      );
      return null;
    }
    if (angularMajor === null) {
      logger.warn(
        `Could not determine the \`@angular/core\` version, so the ${ANGULAR_VITE_PACKAGE} ` +
          `migration cannot confirm this project is on Angular ${ANGULAR_MIN_MAJOR} or newer. ` +
          `Continuing anyway. If the migrated project fails to build, upgrade Angular first.`
      );
    }

    // Detect webpackFinal in main config by scanning package.json paths for the
    // config dir, then reading main config content.
    let hasWebpackFinal = false;
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      // Look for main config files adjacent to the package.json
      const dir = pkgJsonPath.replace(/[/\\]package\.json$/, '');
      for (const mainName of [
        `${dir}/.storybook/main.ts`,
        `${dir}/.storybook/main.js`,
        `${dir}/.storybook/main.mts`,
        `${dir}/.storybook/main.mjs`,
      ]) {
        try {
          const content = await readFile(mainName, 'utf-8');
          if (content.includes('webpackFinal')) {
            hasWebpackFinal = true;
          }
          break;
        } catch {
          continue;
        }
      }
      if (hasWebpackFinal) {
        break;
      }
    }

    // Collect package.json files that reference a migratable framework.
    const packageJsonFiles: string[] = [];
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      try {
        const raw = await readFile(pkgJsonPath, 'utf-8');
        const pkg = JSON.parse(raw);
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        if (MIGRATABLE_FRAMEWORKS.some((pkg) => pkg in deps)) {
          packageJsonFiles.push(pkgJsonPath);
        }
      } catch {
        continue;
      }
    }

    return {
      framework,
      hasWebpackFinal,
      packageJsonFiles,
      angularVersion: angularMajor === null ? null : angularSpecifier,
    };
  },

  prompt() {
    return 'Migrate from @storybook/angular (Webpack) or @analogjs/storybook-angular to @storybook/angular-vite (in preview).';
  },

  async run({
    result,
    dryRun = false,
    mainConfig,
    mainConfigPath,
    previewConfigPath,
    storiesPaths,
    configDir,
    packageManager,
    storybookVersion,
    yes,
    addonsToPostinstall,
  }) {
    if (!result) {
      return;
    }

    // When webpackFinal is present, warn prominently and ask whether to continue.
    if (result.hasWebpackFinal) {
      logger.logBox(
        dedent`
          We detected a \`webpackFinal\` hook in your Storybook main config.

          \`webpackFinal\` is a Webpack-specific API and will not carry over to Vite.
          You will need to port it to \`viteFinal\` after the migration.
          See ${VITE_CONFIG_DOC_URL} for porting guidance.
        `
      );

      const shouldContinue = yes
        ? false
        : await prompt.confirm({
            message: 'I detected a webpackFinal hook. It will not carry over. Continue anyway?',
            initialValue: false,
          });

      if (!shouldContinue) {
        logger.log(
          'Migration cancelled. Port your webpackFinal hook to viteFinal first, then run the automigration again.'
        );
        return;
      }
    }

    logger.step(`Migrating from ${result.framework} to ${ANGULAR_VITE_PACKAGE}...`);

    // 1. Patch .storybook/main.ts(.js). This comes first because everything below assumes the
    // framework already says angular-vite: `check()` reads it off the evaluated config, so the
    // field can be inherited from a shared base file rather than spelled out in this one.
    logger.debug('Updating main config...');
    if (!mainConfigPath || !(await transformMainConfig(mainConfigPath, dryRun, result.framework))) {
      logger.error(
        dedent`
          Migration stopped: the \`framework\` field could not be rewritten in ${mainConfigPath ?? 'your Storybook main config'}.
          That file names no \`${result.framework}\`, so it most likely inherits the framework from a shared config.
          Point \`framework\` at \`${ANGULAR_VITE_PACKAGE}\` where it is declared, then run this migration again.
        `
      );
      return;
    }

    // 2. Update dependencies.
    if (dryRun) {
      logger.debug('Dry run: Skipping dependency updates.');
    } else {
      logger.debug('Updating dependencies...');
      // `@analogjs/storybook-angular` declares `@storybook/angular` as a peer, so an Analog project
      // carries both and neither renders anything once the framework points at angular-vite.
      await packageManager.removeDependencies(
        result.framework === ANALOG_PACKAGE ? [ANALOG_PACKAGE, ANGULAR_PACKAGE] : [ANGULAR_PACKAGE]
      );

      const allDeps = packageManager.getAllDependencies();
      const { angularVersion } = result;
      // `@angular-devkit/architect` numbers itself `0.<major * 100 + minor>.<patch>`, so it cannot
      // take the Angular range unchanged.
      const architectVersion = toDevkitVersion(angularVersion);

      const unpinnableAngularPeers = angularVersion
        ? []
        : [
            ANGULAR_BUILD_PACKAGE,
            ANGULAR_ANIMATIONS_PACKAGE,
            ANGULAR_DEVKIT_ARCHITECT_PACKAGE,
          ].filter((pkg) => !allDeps[pkg]);

      if (unpinnableAngularPeers.length > 0) {
        logger.warn(
          `Could not determine the \`@angular/core\` version, so ` +
            `${unpinnableAngularPeers.map((pkg) => `\`${pkg}\``).join(', ')} were not added. ` +
            `${ANGULAR_VITE_PACKAGE} needs them at your Angular version, and adding them ` +
            `unpinned would install the next Angular major. Add them by hand before starting ` +
            `Storybook.`
        );
      }

      await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
        `${ANGULAR_VITE_PACKAGE}@${storybookVersion}`,
        ...(allDeps[ANALOG_VITE_PLUGIN_PACKAGE]
          ? []
          : [`${ANALOG_VITE_PLUGIN_PACKAGE}@${ANALOG_VITE_PLUGIN_ANGULAR_VERSION}`]),
        ...(allDeps[ANGULAR_BUILD_PACKAGE] || !angularVersion
          ? []
          : [`${ANGULAR_BUILD_PACKAGE}@${angularVersion}`]),
        ...(allDeps[ANGULAR_ANIMATIONS_PACKAGE] || !angularVersion
          ? []
          : [`${ANGULAR_ANIMATIONS_PACKAGE}@${angularVersion}`]),
        ...(allDeps[ANGULAR_DEVKIT_ARCHITECT_PACKAGE] || !architectVersion
          ? []
          : [`${ANGULAR_DEVKIT_ARCHITECT_PACKAGE}@${architectVersion}`]),
      ]);
    }

    let anyStorybookTarget = false;
    let anyZoneBasedTarget = false;

    // 3. Rewrite Angular CLI builder references in angular.json.
    // Search for angular.json beside every package.json we know about.
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      const dir = pkgJsonPath.replace(/[/\\]package\.json$/, '');
      const angularJsonPath = `${dir}/angular.json`;
      const {
        changed,
        hasStorybookTarget,
        anyZoneBasedTarget: zoneBased,
      } = transformAngularJson(angularJsonPath, dryRun);
      if (hasStorybookTarget) {
        anyStorybookTarget = true;
        anyZoneBasedTarget = anyZoneBasedTarget || zoneBased;
      }
      if (changed) {
        logger.debug(`Updated Angular CLI builder references in ${angularJsonPath}`);
      }
    }

    // 3b. Rewrite Angular builder references in Nx `project.json` files.
    // Nx workspaces scatter `project.json` files (e.g. `libs/*/project.json`)
    // away from `package.json` and use `executor` rather than angular.json's
    // `builder`; the `@storybook/angular:<target>` string is identical, so the
    // same rewrite applies. Glob the workspace since they are not co-located
    // with package.json the way angular.json is.
    const projectJsonFiles = await findWorkspaceFiles('project.json');
    for (const projectJsonPath of projectJsonFiles) {
      const {
        changed,
        hasStorybookTarget,
        anyZoneBasedTarget: zoneBased,
      } = await transformProjectJson(projectJsonPath, dryRun);
      if (hasStorybookTarget) {
        anyStorybookTarget = true;
        anyZoneBasedTarget = anyZoneBasedTarget || zoneBased;
      }
      if (changed) {
        logger.debug(`Updated Nx builder references in ${projectJsonPath}`);
      }
    }

    // 4. Rewrite Angular CLI builder references and the `test-storybook` script in package.json.
    // The write goes through the package manager: it reads package.json from a process-wide cache
    // that a raw write cannot invalidate, so a later `addDependencies` would undo this one.
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      try {
        const content = await readFile(pkgJsonPath, 'utf-8');
        const transformed = rewriteTestStorybookScript(rewriteBuilderRefs(content));
        if (transformed !== content && !dryRun) {
          packageManager.writePackageJson(JSON.parse(transformed), dirname(pkgJsonPath));
          logger.debug(`Updated builder references and scripts in ${pkgJsonPath}`);
        }
      } catch {
        continue;
      }
    }

    // 4b. Drop the Compodoc setup. `@storybook/angular-vite` extracts Angular metadata on the
    // server, so nothing here runs Compodoc or reads its output. The dedicated
    // `angular-vite-remove-compodoc` fix cannot do it: every fix is checked against the main config
    // as it stood when the run started, where the framework is still `@storybook/angular`.
    if (mainConfigPath) {
      try {
        const compodocSetup = await findCompodocSetup({
          mainConfig,
          previewConfigPath,
          packageManager,
          builderPackages: [ANGULAR_VITE_PACKAGE, ...MIGRATABLE_FRAMEWORKS],
        });
        if (compodocSetup) {
          await removeCompodocSetup({
            result: compodocSetup,
            dryRun: !!dryRun,
            mainConfigPath,
            previewConfigPath,
            packageManager,
          });
        }
      } catch (error) {
        logger.warn(
          `Could not remove the Compodoc setup automatically: ${error}. ` +
            'Compodoc no longer runs, so its options and the `setCompodocJson` wiring can go.'
        );
      }
    }

    const hasZoneJsDependency = packageManager.isDependencyInstalled('zone.js');

    if (anyStorybookTarget && anyZoneBasedTarget && !hasZoneJsDependency) {
      logger.warn(
        'A Storybook builder target sets `zoneless: false`, but this project does not depend on ' +
          "`zone.js`, so no `import 'zone.js';` was added to your preview - it could not resolve, " +
          'and every story would fail to load. Install `zone.js`, or set `zoneless: true` on that ' +
          'target if your app uses zoneless change detection.'
      );
    }

    const needsZoneJs = anyStorybookTarget && hasZoneJsDependency;
    if (needsZoneJs && previewConfigPath) {
      await addZoneJsPreviewImport(previewConfigPath, dryRun);
    } else if (needsZoneJs && !previewConfigPath) {
      logger.warn(
        "Could not find a Storybook preview file to add the zone.js import to. If your app uses zone-based change detection, add `import 'zone.js';` at the top of your preview file manually."
      );
    }

    // 5. Update import statements across config and story files.
    logger.debug('Scanning and updating import statements...');
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    const configFiles = configDir ? await globby([`${configDir}/**/*`]) : [];
    const allFiles = [...storiesPaths, ...configFiles].filter(Boolean) as string[];

    const transformErrors = await transformImportFiles(
      allFiles,
      Object.fromEntries(MIGRATABLE_FRAMEWORKS.map((pkg) => [pkg, ANGULAR_VITE_PACKAGE])),
      !!dryRun
    );

    if (transformErrors.length > 0) {
      logger.warn(`Encountered ${transformErrors.length} error(s) during file transformation:`);
      transformErrors.forEach(({ file, error }) => {
        logger.warn(`  - ${file}: ${error.message}`);
      });
    }

    // 6. Offer optional addons.
    if (!dryRun) {
      const wantsVitest = yes
        ? true
        : await prompt.confirm({
            message:
              'Set up @storybook/addon-vitest? (Recommended — enables in-browser component tests with Vitest)',
            initialValue: true,
          });

      if (wantsVitest) {
        // Create a standalone vitest.config.ts (already wired with storybookAngularVitest) when the
        // project has no Vite/Vitest config yet. The deferred addon-vitest postinstall is
        // idempotent: it detects this fully-wired config and skips, and updates an existing config
        // when one is found — so we only create the file here, never overwrite.
        if (configDir && !findExistingViteConfig(configDir)) {
          const newConfigFile = resolve(dirname(configDir), 'vitest.config.ts');
          const configDirRelative = relative(dirname(newConfigFile), configDir);
          const formatted = await formatFileContent(
            newConfigFile,
            buildAngularVitestConfig(configDirRelative)
          );
          await writeFile(newConfigFile, formatted);
          logger.step(`Creating a Vitest config file: ${newConfigFile}`);
        }

        try {
          // Add to package.json + main.ts now, but defer the postinstall: dependencies are
          // installed in a single batch at the end of automigrate, so the addon isn't on disk
          // yet and its postinstall hook can't be resolved here. The runner configures it after
          // install (see `addonsToPostinstall`), mirroring CLI init's install-then-configure order.
          await add('@storybook/addon-vitest', {
            packageManager: packageManager.type,
            configDir,
            skipInstall: true,
            skipPostinstall: true,
            yes: !!yes,
          });
          addonsToPostinstall?.push('@storybook/addon-vitest');
        } catch (err) {
          logger.warn(`Could not set up @storybook/addon-vitest automatically: ${err}`);
          logger.warn('Run `npx storybook add @storybook/addon-vitest` manually to set it up.');
        }
      }

      const wantsA11y = yes
        ? true
        : await prompt.confirm({
            message: 'Set up @storybook/addon-a11y? (Adds accessibility checks to your stories)',
            initialValue: true,
          });

      if (wantsA11y) {
        try {
          // Deferred postinstall, same as addon-vitest above.
          await add('@storybook/addon-a11y', {
            packageManager: packageManager.type,
            configDir,
            skipInstall: true,
            skipPostinstall: true,
            yes: !!yes,
          });
          addonsToPostinstall?.push('@storybook/addon-a11y');
        } catch (err) {
          logger.warn(`Could not set up @storybook/addon-a11y automatically: ${err}`);
          logger.warn('Run `npx storybook add @storybook/addon-a11y` manually to set it up.');
        }
      }
    }

    logger.step('Migration completed successfully!');
    logger.log(`For more information, see: ${FRAMEWORK_DOC_URL}`);
  },
};
