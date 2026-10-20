import { existsSync } from 'fs';

import {
  formatExistingFile,
  frameworkPackages,
  getAddonNames,
  rendererPackages,
} from 'storybook/internal/common';

import jscodeshift from 'jscodeshift';
import path from 'path';
import picocolors from 'picocolors';
import semver from 'semver';
import { dedent } from 'ts-dedent';

import type { types as t } from 'storybook/internal/babel';
import { getHeaderComments } from 'storybook/internal/csf-tools';

import { findFilesUp } from '../../util.ts';
import type { Fix } from '../types.ts';
import {
  extractSetupFileEntries,
  PRINT_OPTIONS,
  removeSetupFileEntries,
  VITEST_PLUGIN_MODULE,
  type ExtendsDefault,
  type ProjectKind,
  type SetupFileEntry,
} from './vitest-setup-file/vitest-config-entries.ts';

const VITEST_ADDON_NAME = '@storybook/addon-vitest';
const A11Y_ADDON_NAME = '@storybook/addon-a11y';
const A11Y_PREVIEW_MODULE = '@storybook/addon-a11y/preview';

const SETUP_FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.cts', '.mts', '.cjs', '.mjs'];
const CONFIG_FILE_PATTERNS = [
  'vitest.config.{js,ts,mjs,cjs,mts,cts}',
  'vite.config.{js,ts,mjs,cjs,mts,cts}',
];

interface VitestSetupFileInfo {
  path: string;
  transform:
    // The `setProjectAnnotations()` call was removed but other statements remain; `code` is written back to the file
    | { kind: 'rewritten'; code: string }
    // Nothing remains after removing the call, so the file and its `setupFiles` entries are deleted
    | { kind: 'empty' }
    // The call can't be removed safely; `reason` is shown to the user as a manual step
    | { kind: 'manual'; reason: string };
}

export interface VitestSetupFileOptions {
  /** The resolved Storybook config dir, carried from `check` so `run` rewrites against the same one */
  configDir: string;
  setupFiles: VitestSetupFileInfo[];
  configFiles: string[];
  unresolvedEntries: {
    configFile: string;
    expression: string;
    project: ProjectKind;
  }[];
  inheritsRootByDefault: ExtendsDefault;
}

/**
 * `@storybook/addon-vitest` applies the project annotations itself, and `setProjectAnnotations`
 * replaces whatever was applied before it, so a leftover call in a Vitest setup file discards the
 * addon's annotations. This fix removes such calls when they only pass `.storybook/preview` or
 * `@storybook/addon-a11y/preview`, deletes setup files that end up empty, and drops their
 * `setupFiles` entries from the Vitest/Vite config files that reference them.
 */
export const vitestSetupFile: Fix<VitestSetupFileOptions> = {
  id: 'vitest-setup-file',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-setprojectannotations-must-not-be-called-in-setup-files',

  promptType: 'auto',

  async check({ mainConfig, configDir: rawConfigDir, packageManager, files }) {
    if (!rawConfigDir) {
      return null;
    }
    // The CLI passes the config dir as given on the command line, which may be relative
    const configDir = path.resolve(rawConfigDir);

    const addons = getAddonNames(mainConfig);

    // Globs come back with forward slashes on every platform; the setup file paths are native
    // Walk from the Storybook config dir and the package root, so a config in either is found.
    const candidateConfigFiles = [
      ...new Set(
        [configDir, packageManager.instanceDir]
          .flatMap((dir) => findFilesUp(CONFIG_FILE_PATTERNS, dir))
          .map((file) => path.resolve(file))
      ),
    ];
    const configSources = new Map<string, string>();

    for (const configFile of candidateConfigFiles) {
      try {
        configSources.set(configFile, await files.read(configFile));
      } catch {}
    }

    // The plugin runs, and so does the runtime error, whether or not the addon is registered
    const pluginInUse = [...configSources.values()].some((source) =>
      source.includes(VITEST_PLUGIN_MODULE)
    );
    if (!pluginInUse && !addons.some((addon) => addon.includes(VITEST_ADDON_NAME))) {
      return null;
    }

    const vitestVersion = await packageManager.getInstalledVersion('vitest');
    const inheritsRootByDefault: ExtendsDefault =
      vitestVersion === null ? 'unknown' : semver.major(vitestVersion) >= 5;

    const candidateSetupFiles = new Set(
      SETUP_FILE_EXTENSIONS.map((extension) =>
        path.join(configDir, `vitest.setup${extension}`)
      ).filter((filePath) => existsSync(filePath))
    );

    const unresolvedEntries: VitestSetupFileOptions['unresolvedEntries'] = [];
    const referencesBySetupFile = new Map<string, { configFile: string; project: ProjectKind }[]>();

    for (const [configFile, source] of configSources) {
      let entries: SetupFileEntry[];
      try {
        entries = extractSetupFileEntries(
          source,
          configFile,
          inheritsRootByDefault,
          configDir,
          packageManager.instanceDir
        );
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.kind === 'unresolved') {
          unresolvedEntries.push({
            configFile,
            expression: entry.expression,
            project: entry.project,
          });
        } else if (existsSync(entry.path)) {
          candidateSetupFiles.add(entry.path);
          referencesBySetupFile.set(entry.path, [
            ...(referencesBySetupFile.get(entry.path) ?? []),
            { configFile, project: entry.project },
          ]);
        }
      }
    }

    const a11yRegistered = addons.some((addon) => addon.includes(A11Y_ADDON_NAME));
    const setupFiles: VitestSetupFileInfo[] = [];

    for (const filePath of candidateSetupFiles) {
      let source: string;

      try {
        source = await files.read(filePath);
      } catch {
        continue;
      }

      if (!source.includes('setProjectAnnotations')) {
        continue;
      }

      // A file only loaded by projects without the Storybook plugin (e.g. plain portable stories)
      // legitimately keeps its call; the Storybook project never runs it.
      const references = referencesBySetupFile.get(filePath) ?? [];
      const plainReference = references.find((reference) => reference.project === 'plain');
      const unknownReference = references.find((reference) => reference.project === 'unknown');

      if (plainReference && references.every((reference) => reference.project === 'plain')) {
        continue;
      }

      const transform = plainReference
        ? {
            kind: 'manual' as const,
            reason: `it is also listed in "setupFiles" of a Vitest project without the Storybook plugin (${plainReference.configFile}), so its "setProjectAnnotations" call is still needed there; remove the file from the Storybook project's "setupFiles" instead`,
          }
        : unknownReference
          ? {
              kind: 'manual' as const,
              reason: `it is listed in "setupFiles" of a Vitest project whose plugins can't be read statically (${unknownReference.configFile}), so whether it still needs its "setProjectAnnotations" call there is unclear; remove the call yourself if that project uses the Storybook plugin, otherwise list the file only in that project's "setupFiles"`,
            }
          : transformSetupFile(source, { setupFilePath: filePath, configDir, a11yRegistered });

      // Deleting a file that a config outside the scan still loads would break the next run; an
      // unresolved entry may be such a reference and is reported by `run` instead
      setupFiles.push({
        path: filePath,
        transform:
          transform.kind === 'empty' && references.length === 0 && unresolvedEntries.length === 0
            ? {
                kind: 'manual',
                reason:
                  'no Vitest or Vite config listing it in "setupFiles" was found, so it was left in place; delete it and remove its "setupFiles" entry yourself',
              }
            : transform,
      });
    }

    if (setupFiles.length === 0) {
      return null;
    }

    const configFiles = candidateConfigFiles.filter((configFile) =>
      setupFiles.some((setupFile) =>
        referencesBySetupFile
          .get(setupFile.path)
          ?.some(
            (reference) => reference.configFile === configFile && reference.project === 'storybook'
          )
      )
    );

    return {
      configDir,
      setupFiles,
      configFiles,
      unresolvedEntries,
      inheritsRootByDefault,
    };
  },

  prompt() {
    return `We'll remove "setProjectAnnotations" calls from your Vitest setup files, as ${VITEST_ADDON_NAME} now applies project annotations itself`;
  },

  async run({ result, files, packageManager }) {
    const {
      configDir: storybookConfigDir,
      setupFiles,
      configFiles,
      unresolvedEntries,
      inheritsRootByDefault,
    } = result;

    const deletedPaths = new Set(
      setupFiles.flatMap((setupFile) =>
        setupFile.transform.kind === 'empty' ? [setupFile.path] : []
      )
    );
    const rewritesAny = setupFiles.some((setupFile) => setupFile.transform.kind === 'rewritten');

    const problems = setupFiles.flatMap((setupFile) =>
      setupFile.transform.kind === 'manual'
        ? [`${picocolors.cyan(setupFile.path)}: ${setupFile.transform.reason}`]
        : []
    );

    for (const entry of unresolvedEntries) {
      const location = `${picocolors.cyan(entry.configFile)}: ${picocolors.gray(entry.expression)} is computed at runtime`;

      // A computed entry may be the reference to a file we are about to delete
      if (deletedPaths.size > 0) {
        problems.push(
          `${location}, so the ${picocolors.cyan('setupFiles')} it selects can't be matched without executing your config`
        );
      } else if (
        rewritesAny &&
        entry.project !== 'storybook' &&
        configFiles.includes(entry.configFile)
      ) {
        // ...or, next to the Storybook project loading a file we are about to rewrite, it may load
        // that file in a plain project that still needs the call
        problems.push(
          `${location} in a Vitest project without the Storybook plugin, so it may select a setup file whose ${picocolors.cyan('setProjectAnnotations')} call is still needed there`
        );
      }
    }

    if (problems.length > 0) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(
        dedent`
        The ${this.id} automigration couldn't migrate your Vitest setup file(s) automatically, but here are instructions for doing it yourself:

        ${problems.map((problem, index) => `${index + 1}) ${problem}`).join('\n\n')}

        ${picocolors.cyan(VITEST_ADDON_NAME)} applies your project annotations itself: your ${picocolors.cyan('.storybook/preview')} file and the previews of the addons registered in ${picocolors.cyan('.storybook/main')}. ${picocolors.cyan('setProjectAnnotations')} replaces those annotations, so it must not be called from a Vitest setup file. For each file listed above:
          1. If the call only passes your ${picocolors.cyan('.storybook/preview')} annotations, delete the call.
          2. If it passes an addon's annotations, register that addon in the ${picocolors.cyan('addons')} field of ${picocolors.cyan('.storybook/main')} and delete the call.
          3. If it passes custom annotations, move them into ${picocolors.cyan('.storybook/preview')} and delete the call.
          4. If nothing else remains in the file, delete it and remove its entry from ${picocolors.cyan('setupFiles')} in your Vitest config.
          5. If the file is shared with a Vitest project that uses portable stories directly, list it only in that project's ${picocolors.cyan('setupFiles')}.

        Read more: ${this.link}
      `
      );
    }

    for (const { path: setupFile, transform } of setupFiles) {
      if (transform.kind === 'rewritten') {
        files.write(setupFile, await formatExistingFile(setupFile, transform.code));
      }
    }

    if (deletedPaths.size > 0) {
      await files.edit(configFiles, (source, configFile) => {
        const code = removeSetupFileEntries(
          source,
          configFile,
          deletedPaths,
          inheritsRootByDefault,
          storybookConfigDir,
          packageManager.instanceDir
        );
        return code === null ? null : formatExistingFile(configFile, code);
      });
    }

    deletedPaths.forEach((setupFile) => files.remove(setupFile));
  },
};

const ANNOTATIONS_IMPORT_SOURCES = new Set([
  'storybook',
  'storybook/preview-api',
  'storybook/internal/preview-api',
  ...Object.keys(frameworkPackages),
  ...Object.keys(rendererPackages),
]);

const SCRIPT_EXTENSION = /\.(c|m)?(j|t)sx?$/;

interface TransformOptions {
  setupFilePath: string;
  configDir: string;
  a11yRegistered: boolean;
}

/**
 * Removes every top-level `setProjectAnnotations(...)` call whose arguments are only the
 * `.storybook/preview` module or `@storybook/addon-a11y/preview`, together with the imports that
 * become unused and any `beforeAll(project.beforeAll)` forwarding of the call's result. Any other
 * shape is reported for manual migration, because rewriting it could drop custom annotations.
 */
export function transformSetupFile(
  source: string,
  options: TransformOptions
): VitestSetupFileInfo['transform'] {
  const j = jscodeshift.withParser(/\.[jt]sx$/.test(options.setupFilePath) ? 'tsx' : 'ts');
  let root: jscodeshift.Collection;

  try {
    root = j(source);
  } catch {
    return { kind: 'manual', reason: 'it could not be parsed' };
  }

  const program: t.Program = root.get().node.program;

  const bindings = new Map<
    string,
    { declaration: t.ImportDeclaration; specifier: t.ImportDeclaration['specifiers'][number] }
  >();

  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.importKind === 'type') {
      continue;
    }

    for (const specifier of statement.specifiers) {
      bindings.set(specifier.local.name, { declaration: statement, specifier });
    }
  }

  const callBinding = [...bindings.entries()].find(
    ([, { declaration, specifier }]) =>
      specifier.type === 'ImportSpecifier' &&
      specifier.imported.type === 'Identifier' &&
      specifier.imported.name === 'setProjectAnnotations' &&
      ANNOTATIONS_IMPORT_SOURCES.has(String(declaration.source.value))
  );

  if (!callBinding) {
    return {
      kind: 'manual',
      reason: 'it does not import "setProjectAnnotations" from a Storybook package',
    };
  }

  const unsupportedAnnotation = (node: t.Node | null) => ({
    kind: 'manual' as const,
    reason: `it passes annotations that are neither your ".storybook/preview" nor "${A11Y_PREVIEW_MODULE}": ${j(node as unknown as jscodeshift.ASTNode).toSource()}`,
  });

  const annotationName = (
    node: t.Expression | t.SpreadElement | t.ArgumentPlaceholder | null
  ): string | { kind: 'manual'; reason: string } => {
    const identifier =
      node?.type === 'MemberExpression' &&
      !node.computed &&
      node.property.type === 'Identifier' &&
      node.property.name === 'composed'
        ? node.object
        : node;
    const binding = identifier?.type === 'Identifier' ? bindings.get(identifier.name) : undefined;
    if (
      binding?.specifier.type !== 'ImportNamespaceSpecifier' &&
      binding?.specifier.type !== 'ImportDefaultSpecifier'
    ) {
      return unsupportedAnnotation(node);
    }

    const importSource = String(binding.declaration.source.value);
    if (resolvesToPreview(importSource, options)) {
      return binding.specifier.local.name;
    }
    if (importSource === A11Y_PREVIEW_MODULE) {
      return options.a11yRegistered
        ? binding.specifier.local.name
        : {
            kind: 'manual',
            reason: `it passes "${A11Y_PREVIEW_MODULE}" annotations, but ${A11Y_ADDON_NAME} is not registered in the "addons" field of your .storybook/main`,
          };
    }
    return unsupportedAnnotation(node);
  };

  const [firstStatement] = program.body;
  const removedStatements = new Set<t.Statement>();
  const capturedNames = new Set<string>();
  const annotationNames = new Set<string>();

  for (const statement of program.body) {
    const call =
      statement.type === 'ExpressionStatement' && isCallOf(statement.expression, callBinding[0])
        ? statement.expression
        : statement.type === 'VariableDeclaration' &&
            statement.declarations.length === 1 &&
            statement.declarations[0].id.type === 'Identifier' &&
            isCallOf(statement.declarations[0].init, callBinding[0])
          ? statement.declarations[0].init
          : null;

    if (!call) {
      continue;
    }

    if (call.arguments.length > 1) {
      return {
        kind: 'manual',
        reason: 'it calls "setProjectAnnotations" with unexpected arguments',
      };
    }

    const [argument] = call.arguments;
    const elements =
      argument?.type === 'ArrayExpression' ? argument.elements : argument ? [argument] : [];

    for (const element of elements) {
      const name = annotationName(element);
      if (typeof name !== 'string') {
        return name;
      }
      annotationNames.add(name);
    }

    removedStatements.add(statement);
    if (statement.type === 'VariableDeclaration') {
      capturedNames.add((statement.declarations[0].id as t.Identifier).name);
    }
  }

  if (countReferences(j, root, callBinding[0]) !== removedStatements.size) {
    return {
      kind: 'manual',
      reason:
        'the "setProjectAnnotations" call is conditional or wrapped, so it cannot be removed safely',
    };
  }

  for (const name of capturedNames) {
    const forwardings = program.body.filter((statement) => isBeforeAllForwarding(statement, name));

    if (countReferences(j, root, name) !== forwardings.length) {
      return {
        kind: 'manual',
        reason:
          'the value returned by "setProjectAnnotations" is used for more than forwarding "beforeAll"',
      };
    }

    forwardings.forEach((statement) => removedStatements.add(statement));
  }

  program.body = program.body.filter((statement) => !removedStatements.has(statement));

  for (const name of [callBinding[0], ...annotationNames, 'beforeAll']) {
    const binding = bindings.get(name);

    if (!binding || countReferences(j, root, name) > 0) {
      continue;
    }

    binding.declaration.specifiers = binding.declaration.specifiers.filter(
      (specifier) => specifier !== binding.specifier
    );

    if (binding.declaration.specifiers.length === 0) {
      program.body = program.body.filter((statement) => statement !== binding.declaration);
    }
  }

  if (program.body.length === 0) {
    return { kind: 'empty' };
  }

  keepHeader(firstStatement, program.body[0]);
  return { kind: 'rewritten', code: root.toSource(PRINT_OPTIONS) };
}

function keepHeader(removed: t.Statement | undefined, first: t.Statement) {
  const header = getHeaderComments(removed);
  if (removed === first || !header.length) {
    return;
  }
  const commented = first as { comments?: t.Comment[] };
  commented.comments = [...header, ...(commented.comments ?? [])];
}

function resolvesToPreview(importSource: string, options: TransformOptions) {
  if (!importSource.startsWith('.')) {
    return false;
  }
  const resolved = path
    .resolve(path.dirname(options.setupFilePath), importSource)
    .replace(SCRIPT_EXTENSION, '');
  return resolved === path.resolve(options.configDir, 'preview');
}

function isCallOf(node: t.Node | null | undefined, calleeName: string): node is t.CallExpression {
  return (
    node?.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === calleeName
  );
}

function isBeforeAllForwarding(statement: t.Statement, resultName: string) {
  if (statement.type !== 'ExpressionStatement' || !isCallOf(statement.expression, 'beforeAll')) {
    return false;
  }
  const [argument] = statement.expression.arguments;
  return (
    statement.expression.arguments.length === 1 &&
    argument.type === 'MemberExpression' &&
    !argument.computed &&
    argument.object.type === 'Identifier' &&
    argument.object.name === resultName &&
    argument.property.type === 'Identifier' &&
    argument.property.name === 'beforeAll'
  );
}

/** Counts uses of a binding, ignoring its declaration, member property names and object keys. */
function countReferences(j: jscodeshift.JSCodeshift, root: jscodeshift.Collection, name: string) {
  return root
    .find(j.Identifier, { name })
    .filter((identifierPath) => {
      const parent = identifierPath.parent.node;
      if (
        parent.type === 'ImportSpecifier' ||
        parent.type === 'ImportDefaultSpecifier' ||
        parent.type === 'ImportNamespaceSpecifier' ||
        (parent.type === 'VariableDeclarator' && parent.id === identifierPath.node)
      ) {
        return false;
      }
      if (parent.type === 'MemberExpression' && !parent.computed) {
        return parent.property !== identifierPath.node;
      }
      if ((parent.type === 'ObjectProperty' || parent.type === 'Property') && !parent.computed) {
        return parent.key !== identifierPath.node || parent.shorthand === true;
      }
      return true;
    })
    .size();
}
