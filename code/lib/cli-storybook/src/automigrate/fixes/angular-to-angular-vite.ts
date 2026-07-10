import { readFile, writeFile } from 'node:fs/promises';

import { types as t } from 'storybook/internal/babel';
import {
  AngularJSON,
  editJsonText,
  isStorybookTarget,
  type JSONEditPath,
} from 'storybook/internal/cli';
import { formatFileContent, getProjectRoot, transformImportFiles } from 'storybook/internal/common';
import { type ConfigFile, formatConfig, readConfig } from 'storybook/internal/csf-tools';
import { logger, prompt } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';
import { dirname, relative, resolve } from 'pathe';
import semver from 'semver';
import { dedent } from 'ts-dedent';

import { add } from '../../add.ts';
import { updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';

export const ANGULAR_PACKAGE = '@storybook/angular';
export const ANGULAR_VITE_PACKAGE = '@storybook/angular-vite';

const FRAMEWORK_DOC_URL = 'https://storybook.js.org/docs/get-started/frameworks/angular-vite';
const VITE_CONFIG_DOC_URL = 'https://storybook.js.org/docs/builders/vite#configure';

interface AngularToAngularViteOptions {
  /** True when @angular/core is not found or is outside the 21.x range. */
  angularUnsupportedVersion: boolean;
  /** The detected @angular/core version string, or null if not found. */
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
  content
    .replace(/@storybook\/angular:start-storybook/g, `${ANGULAR_VITE_PACKAGE}:start-storybook`)
    .replace(/@storybook\/angular:build-storybook/g, `${ANGULAR_VITE_PACKAGE}:build-storybook`);

/**
 * Repoint an existing `test-storybook` package.json script at standalone Vitest. The
 * @storybook/test-runner flow does not carry over to @storybook/angular-vite, so the script should
 * run `vitest run` directly. No-ops when the script is absent, and is idempotent (rewriting an
 * already-`vitest run` value yields the same string).
 */
const rewriteTestStorybookScript = (content: string): string =>
  content.replace(/("test-storybook"\s*:\s*)"(?:[^"\\]|\\.)*"/, '$1"vitest run"');

// Config file basenames whose presence means a Vite/Vitest setup already exists, so the migration
// must not write a fresh `vitest.config.ts` over it — the deferred addon-vitest postinstall updates
// the existing file (and the workspace path) instead.
const VITE_CONFIG_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.cts', '.mts', '.cjs', '.mjs'];

/**
 * Find an existing Vite/Vitest/workspace config by searching from the Storybook config dir up to the
 * project root, mirroring the addon-vitest postinstall's lookup. Returns the first match, or
 * `undefined` when none exists.
 */
const findExistingViteConfig = (configDir: string): string | undefined => {
  const search = (basename: string, extensions: string[]) =>
    find.any(
      extensions.map((ext) => basename + ext),
      { last: getProjectRoot(), cwd: configDir }
    );

  return (
    search('vitest.workspace', ['.ts', '.js', '.json']) ||
    search('vite.config', VITE_CONFIG_EXTENSIONS) ||
    search('vitest.config', VITE_CONFIG_EXTENSIONS)
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

const transformMainConfig = async (mainConfigPath: string, dryRun: boolean): Promise<boolean> => {
  try {
    const content = await readFile(mainConfigPath, 'utf-8');

    if (!content.includes(ANGULAR_PACKAGE)) {
      return false;
    }

    // Replace @storybook/angular with @storybook/angular-vite using a negative
    // lookahead so references that are already @storybook/angular-vite are left alone.
    const transformed = content.replace(/@storybook\/angular(?!-vite)/g, ANGULAR_VITE_PACKAGE);

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
  disablesCompodoc: boolean;
  hasStorybookTarget: boolean;
  allStorybookTargetsZonelessTrue: boolean;
}

/** Map the old @storybook/angular builder/executor ref to its angular-vite equivalent, or `null` if unrelated. */
const rewriteStorybookBuilderRef = (ref: string): string | null => {
  if (ref === `${ANGULAR_PACKAGE}:start-storybook`) {
    return `${ANGULAR_VITE_PACKAGE}:start-storybook`;
  }
  if (ref === `${ANGULAR_PACKAGE}:build-storybook`) {
    return `${ANGULAR_VITE_PACKAGE}:build-storybook`;
  }
  return null;
};

/** Applies a single format-preserving edit; shared by `AngularJSON` and `TextJsonEditor` below. */
interface TargetEditor {
  edit(path: JSONEditPath, value: unknown): void;
}

/** A `targets`-shaped object (angular.json's `architect`, or project.json's `targets`) and the JSON path to it. */
interface TargetGroup {
  pathPrefix: JSONEditPath;
  targets: Record<string, unknown>;
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
 * Rewrite builder/executor references, detect Compodoc/zone.js signals, and rename any leftover
 * `experimentalZoneless` key to `zoneless`, across every storybook target in `targetGroups`.
 */
const processStorybookTargets = (
  editor: TargetEditor,
  targetGroups: TargetGroup[]
): Omit<JsonTargetTransformResult, 'allStorybookTargetsZonelessTrue'> & {
  allZonelessTrue: boolean;
} => {
  let changed = false;
  let disablesCompodoc = false;
  let hasStorybookTarget = false;
  let allZonelessTrue = true;

  for (const { pathPrefix, targets } of targetGroups) {
    for (const [targetName, target] of Object.entries(targets)) {
      if (!isStorybookTarget(target)) {
        continue;
      }
      hasStorybookTarget = true;

      // Snapshot before editing: `AngularJSON.edit()` reparses `json`, invalidating `target`.
      const currentRef = target.builder ?? target.executor ?? null;
      const compodocDisabled = target.options?.compodoc === false;
      const hasOldZonelessKey = !!target.options && 'experimentalZoneless' in target.options;
      const zonelessValue = target.options?.experimentalZoneless;

      if (compodocDisabled) {
        disablesCompodoc = true;
      }
      if (zonelessValue !== true) {
        allZonelessTrue = false;
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

  return { changed, disablesCompodoc, hasStorybookTarget, allZonelessTrue };
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
      disablesCompodoc: false,
      hasStorybookTarget: false,
      allStorybookTargetsZonelessTrue: true,
    };
  }

  const targetGroups: TargetGroup[] = Object.entries(angularJSON.projects)
    .filter(([, project]) => project?.architect && typeof project.architect === 'object')
    .map(([projectName, project]) => ({
      pathPrefix: ['projects', projectName, 'architect'],
      targets: project.architect,
    }));

  const { changed, disablesCompodoc, hasStorybookTarget, allZonelessTrue } =
    processStorybookTargets(angularJSON, targetGroups);

  if (changed && !dryRun) {
    angularJSON.write();
  }

  return {
    changed,
    disablesCompodoc,
    hasStorybookTarget,
    allStorybookTargetsZonelessTrue: allZonelessTrue,
  };
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
    const targets = json?.targets;

    const editor = new TextJsonEditor(original);
    const targetGroups: TargetGroup[] =
      targets && typeof targets === 'object' ? [{ pathPrefix: ['targets'], targets }] : [];

    const { changed, disablesCompodoc, hasStorybookTarget, allZonelessTrue } =
      processStorybookTargets(editor, targetGroups);

    if (changed && !dryRun) {
      await writeFile(projectJsonPath, editor.content);
    }

    return {
      changed,
      disablesCompodoc,
      hasStorybookTarget,
      allStorybookTargetsZonelessTrue: allZonelessTrue,
    };
  } catch {
    return {
      changed: false,
      disablesCompodoc: false,
      hasStorybookTarget: false,
      allStorybookTargetsZonelessTrue: true,
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

/**
 * Set `framework.options.compodoc` to `false` in main config, preserving the framework name.
 *
 * `framework` can take three shapes, and each needs different handling so the name survives:
 *
 * - Bare string: `framework: '@storybook/angular-vite'`
 * - Wrapped call: `framework: getAbsolutePath('@storybook/angular-vite')`
 * - Object form: `framework: { name: ..., options: {...} }`
 *
 * For the string and call-expression shapes, a nested `setFieldValue(['framework', 'options',
 * 'compodoc'], false)` would replace the whole `framework` value, dropping the name (e.g. producing
 * `framework: { options: { compodoc: false } }`). So we operate on the AST node directly and wrap
 * the original node as `name`, which preserves a `getAbsolutePath(...)` call verbatim. The object
 * shape (inline or referenced via a variable) is already nestable, so the nested set is correct.
 */
export const setFrameworkCompodocFalse = (main: ConfigFile): void => {
  const frameworkNode = main.getFieldNode(['framework']);

  if (frameworkNode && (t.isStringLiteral(frameworkNode) || t.isCallExpression(frameworkNode))) {
    main.setFieldNode(
      ['framework'],
      t.objectExpression([
        t.objectProperty(t.identifier('name'), frameworkNode),
        t.objectProperty(
          t.identifier('options'),
          t.objectExpression([t.objectProperty(t.identifier('compodoc'), t.booleanLiteral(false))])
        ),
      ])
    );
    return;
  }

  // Object form (inline or via a variable reference): keep the existing name and options.
  main.setFieldValue(['framework', 'options', 'compodoc'], false);
};

export const angularToAngularVite: Fix<AngularToAngularViteOptions> = {
  id: 'angular-to-angular-vite',
  link: FRAMEWORK_DOC_URL,
  defaultSelected: false,

  async check({ packageManager }): Promise<AngularToAngularViteOptions | null> {
    const allDeps = packageManager.getAllDependencies();

    // Only apply when @storybook/angular is present and @storybook/angular-vite is not.
    if (!allDeps[ANGULAR_PACKAGE] || allDeps[ANGULAR_VITE_PACKAGE]) {
      return null;
    }

    // Detect @angular/core version for the Angular 21 prerequisite check.
    const angularVersionRaw = packageManager.getDependencyVersion('@angular/core');
    const angularVersion = angularVersionRaw
      ? (semver.coerce(angularVersionRaw)?.version ?? null)
      : null;
    const angularUnsupportedVersion =
      !angularVersion || !semver.satisfies(angularVersion, '>=21.0.0');

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

    // Collect package.json files that reference @storybook/angular.
    const packageJsonFiles: string[] = [];
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      try {
        const raw = await readFile(pkgJsonPath, 'utf-8');
        const pkg = JSON.parse(raw);
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        if (Object.keys(deps).includes(ANGULAR_PACKAGE)) {
          packageJsonFiles.push(pkgJsonPath);
        }
      } catch {
        continue;
      }
    }

    return {
      angularUnsupportedVersion,
      angularVersion,
      hasWebpackFinal,
      packageJsonFiles,
    };
  },

  prompt() {
    return 'Migrate from @storybook/angular (Webpack) to @storybook/angular-vite (in preview).';
  },

  async run({
    result,
    dryRun = false,
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

    // Hard bail if Angular version is unsupported — the prompt already told the user what to do.
    if (result.angularUnsupportedVersion) {
      logger.log(
        dedent`
          Migration skipped: Angular 21 is required.
          Run \`ng update @angular/core @angular/cli\` to upgrade, then try again.
        `
      );
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

    logger.step(`Migrating from ${ANGULAR_PACKAGE} to ${ANGULAR_VITE_PACKAGE}...`);

    // 1. Update dependencies.
    if (dryRun) {
      logger.debug('Dry run: Skipping dependency updates.');
    } else {
      logger.debug('Updating dependencies...');
      await packageManager.removeDependencies([ANGULAR_PACKAGE]);

      // Required peer dependencies of @storybook/angular-vite that a webpack-based Angular
      // project may not have (@angular/animations is only an optional peer of
      // @storybook/angular). npm auto-installs missing peers, but yarn and pnpm do not, so
      // they must be added explicitly — mirroring the init generator. Packages the project
      // already declares are left untouched. `vite` is a direct dependency of the framework,
      // so it needs no entry here.
      const allDeps = packageManager.getAllDependencies();
      const angularVersion = packageManager.getDependencyVersion('@angular/core');
      const requiredPeerDeps = [
        { name: '@analogjs/vite-plugin-angular', spec: '@analogjs/vite-plugin-angular' },
        {
          name: '@angular/animations',
          spec: angularVersion ? `@angular/animations@${angularVersion}` : '@angular/animations',
        },
      ];

      await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
        `${ANGULAR_VITE_PACKAGE}@${storybookVersion}`,
        ...requiredPeerDeps.filter(({ name }) => !allDeps[name]).map(({ spec }) => spec),
      ]);
    }

    // 2. Patch .storybook/main.ts(.js).
    if (mainConfigPath) {
      logger.debug('Updating main config...');
      await transformMainConfig(mainConfigPath, dryRun);
    }

    // Track whether any migrated builder config disabled Compodoc, so the
    // intent can be carried into framework.options (step 4b).
    let disableCompodoc = false;
    // Injection fires unless EVERY storybook target sets `experimentalZoneless: true`.
    let anyStorybookTarget = false;
    let allZonelessTrue = true;

    // 3. Rewrite Angular CLI builder references in angular.json.
    // Search for angular.json beside every package.json we know about.
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      const dir = pkgJsonPath.replace(/[/\\]package\.json$/, '');
      const angularJsonPath = `${dir}/angular.json`;
      const { changed, disablesCompodoc, hasStorybookTarget, allStorybookTargetsZonelessTrue } =
        transformAngularJson(angularJsonPath, dryRun);
      disableCompodoc ||= disablesCompodoc;
      if (hasStorybookTarget) {
        anyStorybookTarget = true;
        allZonelessTrue = allZonelessTrue && allStorybookTargetsZonelessTrue;
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
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    const projectJsonFiles = await globby(['**/project.json'], {
      ignore: ['**/node_modules/**', '**/dist/**'],
      absolute: true,
    });
    for (const projectJsonPath of projectJsonFiles) {
      const { changed, disablesCompodoc, hasStorybookTarget, allStorybookTargetsZonelessTrue } =
        await transformProjectJson(projectJsonPath, dryRun);
      disableCompodoc ||= disablesCompodoc;
      if (hasStorybookTarget) {
        anyStorybookTarget = true;
        allZonelessTrue = allZonelessTrue && allStorybookTargetsZonelessTrue;
      }
      if (changed) {
        logger.debug(`Updated Nx builder references in ${projectJsonPath}`);
      }
    }

    // 4. Rewrite Angular CLI builder references and the `test-storybook` script in package.json.
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      try {
        const content = await readFile(pkgJsonPath, 'utf-8');
        const transformed = rewriteTestStorybookScript(rewriteBuilderRefs(content));
        if (transformed !== content && !dryRun) {
          await writeFile(pkgJsonPath, transformed);
          logger.debug(`Updated builder references and scripts in ${pkgJsonPath}`);
        }
      } catch {
        continue;
      }
    }

    // 4b. Carry a disabled Compodoc setting into framework.options. Compodoc is
    // now generated only by the framework Vite plugin (default on), so a builder
    // `compodoc: false` must move to main.ts — otherwise the cold-start default
    // would silently re-enable it.
    if (disableCompodoc && mainConfigPath) {
      try {
        await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
          if (dryRun) {
            return;
          }

          setFrameworkCompodocFalse(main);
        });
        logger.debug('Carried `compodoc: false` into framework.options.');
      } catch (error) {
        logger.warn(
          `Could not set \`framework.options.compodoc\` automatically: ${error}. ` +
            "Set `compodoc: false` in your main config's framework.options manually."
        );
      }
    }

    const needsZoneJs = anyStorybookTarget && !allZonelessTrue;
    if (needsZoneJs && previewConfigPath) {
      await addZoneJsPreviewImport(previewConfigPath, dryRun);
    } else if (needsZoneJs && !previewConfigPath) {
      logger.warn(
        "Could not find a Storybook preview file to add the zone.js import to. If your app uses zone-based change detection, add `import 'zone.js';` at the top of your preview file manually."
      );
    }

    // 5. Update import statements across config and story files.
    logger.debug('Scanning and updating import statements...');
    const configFiles = configDir ? await globby([`${configDir}/**/*`]) : [];
    const allFiles = [...storiesPaths, ...configFiles].filter(Boolean) as string[];

    const transformErrors = await transformImportFiles(
      allFiles,
      { [ANGULAR_PACKAGE]: ANGULAR_VITE_PACKAGE },
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
