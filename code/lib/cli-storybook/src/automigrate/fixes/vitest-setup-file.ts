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

const VITEST_ADDON_NAME = '@storybook/addon-vitest';
const VITEST_PLUGIN_MODULE = '@storybook/addon-vitest/vitest-plugin';
const A11Y_ADDON_NAME = '@storybook/addon-a11y';
const A11Y_PREVIEW_MODULE = '@storybook/addon-a11y/preview';

// Recast defaults this to `os.EOL`, which would carriage-return printed files on Windows.
const PRINT_OPTIONS = { lineTerminator: '\n' };

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

interface VitestSetupFileOptions {
  setupFiles: VitestSetupFileInfo[];
  configFiles: string[];
  unresolvedEntries: {
    configFile: string;
    expression: string;
    project: ProjectKind;
  }[];
  inheritsRootByDefault: ExtendsDefault;
}

// What a project without an `extends` property does: Vitest 5 inherits the root config unless the
// project opts out, Vitest 4 only inherits with `extends: true`. `unknown` when no Vitest is found.
type ExtendsDefault = boolean | 'unknown';

// Whether the Vitest project owning a `setupFiles` entry loads the `storybookTest` plugin. It is
// `unknown` when the plugins come from somewhere the fix can't read: `mergeConfig`, a path in
// `extends`, or a spread `plugins` array.
type ProjectKind = 'storybook' | 'plain' | 'unknown';

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
    const candidateConfigFiles = findFilesUp(CONFIG_FILE_PATTERNS, packageManager.instanceDir).map(
      (file) => path.resolve(file)
    );
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
        entries = extractSetupFileEntries(source, configFile, inheritsRootByDefault);
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

    return { setupFiles, configFiles, unresolvedEntries, inheritsRootByDefault };
  },

  prompt() {
    return `We'll remove "setProjectAnnotations" calls from your Vitest setup files, as ${VITEST_ADDON_NAME} now applies project annotations itself`;
  },

  async run({ result, files }) {
    const { setupFiles, configFiles, unresolvedEntries, inheritsRootByDefault } = result;

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
          inheritsRootByDefault
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

/**
 * A `setupFiles` entry, either statically resolved to an absolute path or reported verbatim so a
 * deleted setup file never stays referenced by an entry the fix could not read. `project` tells
 * whether the project (or root config) owning the entry loads the `storybookTest` plugin.
 */
type SetupFileEntry =
  | { kind: 'resolved'; path: string; project: ProjectKind }
  | { kind: 'unresolved'; expression: string; project: ProjectKind };

function extractSetupFileEntries(
  source: string,
  configFile: string,
  inheritsRootByDefault: ExtendsDefault
): SetupFileEntry[] {
  const j = jscodeshift.withParser('ts');
  const root = j(source);
  const pluginNames = getStorybookPluginNames(j, root);
  const entries: SetupFileEntry[] = [];

  root
    .find(j.ObjectProperty)
    .filter((propertyPath) => isKeyNamed(propertyPath.value.key, 'setupFiles'))
    .forEach((propertyPath) => {
      const value = propertyPath.value.value;
      const nodes = value.type === 'ArrayExpression' ? value.elements : [value];

      // A root-level `setupFiles` is listed once per inheriting project, each resolved against
      // that project's root, so one inherited by a Storybook and a plain project surfaces as both
      const owners = getOwningConfigObjects(j, propertyPath, inheritsRootByDefault);
      const seen = new Set<string>();
      const collect = (entry: SetupFileEntry) => {
        const key = `${entry.project}:${entry.kind === 'resolved' ? entry.path : entry.expression}`;
        if (!seen.has(key)) {
          seen.add(key);
          entries.push(entry);
        }
      };

      for (const owner of owners === 'unknown' ? [null] : owners) {
        const project = owner
          ? classifyConfigObject(j, owner, pluginNames, inheritsRootByDefault)
          : 'unknown';
        const base = getSetupFilesBaseDir(propertyPath, owner, configFile);
        if ('unresolvedRoot' in base) {
          collect({
            kind: 'unresolved',
            expression: `root: ${j(base.unresolvedRoot).toSource()}`,
            project,
          });
          continue;
        }
        for (const node of nodes) {
          if (!node) {
            continue;
          }
          const resolved = resolveStaticPath(node, configFile);
          collect(
            resolved === null
              ? { kind: 'unresolved', expression: j(node).toSource(), project }
              : { kind: 'resolved', path: path.resolve(base.baseDir, resolved), project }
          );
        }
      }
    });

  return entries;
}

function getStorybookPluginNames(j: jscodeshift.JSCodeshift, root: jscodeshift.Collection) {
  const names = new Set<string>();
  root
    .find(j.ImportDeclaration, { source: { value: VITEST_PLUGIN_MODULE } })
    .forEach((importPath) => {
      for (const specifier of importPath.node.specifiers ?? []) {
        if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'storybookTest') {
          const local = specifier.local?.name;
          names.add(typeof local === 'string' ? local : 'storybookTest');
        } else if (specifier.type === 'ImportNamespaceSpecifier') {
          names.add('storybookTest');
        }
      }
    });
  return names;
}

type ObjectPropertyPath = jscodeshift.ASTPath<jscodeshift.ObjectProperty>;
type ObjectExpressionPath = jscodeshift.ASTPath<jscodeshift.ObjectExpression>;

// Vitest never runs a root config's `test` options as a project once `projects` is set; its
// `setupFiles` only reach the inline projects that inherit it, which therefore own them. A project
// that may inherit it is counted in, so an uncertain default errs toward reporting a shared file.
// Projects the fix can't read (a variable, a call, a spread) make the owners `unknown`; file-based
// projects (glob strings) don't inherit the root `test` options and are left out.
function getOwningConfigObjects(
  j: jscodeshift.JSCodeshift,
  setupFilesPath: ObjectPropertyPath,
  inheritsRootByDefault: ExtendsDefault
): ObjectExpressionPath[] | 'unknown' {
  const configObject = getEnclosingConfigObject(setupFilesPath);
  if (configObject === null) {
    return 'unknown';
  }
  const testValue = findProperty(configObject.node, 'test')?.value;
  const projects =
    testValue?.type === 'ObjectExpression' ? findProperty(testValue, 'projects')?.value : undefined;
  if (getEnclosingRootConfig(configObject) !== null || projects === undefined) {
    return [configObject];
  }
  if (
    projects.type !== 'ArrayExpression' ||
    projects.elements.some(
      (element) => element?.type !== 'ObjectExpression' && element?.type !== 'StringLiteral'
    )
  ) {
    return 'unknown';
  }

  const inheritingProjects = j(configObject)
    .find(j.ObjectExpression)
    .filter(
      (projectPath) =>
        projects.elements.includes(projectPath.node) &&
        inheritsRootConfig(projectPath.node, inheritsRootByDefault) !== false
    )
    .paths();
  return inheritingProjects.length > 0 ? inheritingProjects : 'unknown';
}

// A path in `extends` inherits that file rather than the root config
function inheritsRootConfig(
  configObject: jscodeshift.ObjectExpression,
  inheritsRootByDefault: ExtendsDefault
): boolean | 'path' | 'unknown' {
  const extendsValue = findProperty(configObject, 'extends')?.value;
  if (!extendsValue) {
    return inheritsRootByDefault;
  }
  return extendsValue.type === 'BooleanLiteral' ? extendsValue.value : 'path';
}

/** Walks from a property of a `test: {}` object up to the project or root config object owning it. */
function getEnclosingConfigObject(testFieldPath: ObjectPropertyPath): ObjectExpressionPath | null {
  const testProperty = testFieldPath.parent?.parent;
  if (
    !testProperty ||
    testProperty.node.type !== 'ObjectProperty' ||
    !isKeyNamed(testProperty.node.key, 'test')
  ) {
    return null;
  }
  const configObject = testProperty.parent;
  return configObject?.node.type === 'ObjectExpression' ? configObject : null;
}

function classifyConfigObject(
  j: jscodeshift.JSCodeshift,
  configObject: ObjectExpressionPath,
  pluginNames: Set<string>,
  inheritsRootByDefault: ExtendsDefault
): ProjectKind {
  const plugins = findProperty(configObject.node, 'plugins')?.value;
  if (
    plugins &&
    j(plugins)
      .find(j.CallExpression)
      .some((call) => pluginNames.has(calleeName(call.node.callee) ?? ''))
  ) {
    return 'storybook';
  }
  if (
    plugins &&
    (plugins.type !== 'ArrayExpression' ||
      plugins.elements.some((element) => element?.type === 'SpreadElement'))
  ) {
    return 'unknown';
  }

  const own: ProjectKind = isMergedConfig(configObject) ? 'unknown' : 'plain';
  const rootConfig = getEnclosingRootConfig(configObject);
  if (rootConfig === null) {
    return own;
  }

  const inherits = inheritsRootConfig(configObject.node, inheritsRootByDefault);
  if (inherits === 'path') {
    return 'unknown';
  }
  if (inherits === false) {
    return own;
  }
  const inherited = classifyConfigObject(j, rootConfig, pluginNames, inheritsRootByDefault);
  if (inherits === true) {
    return inherited;
  }
  // The default is not known, which only matters when inheriting would change the answer
  return inherited === own ? own : 'unknown';
}

function isMergedConfig(configObject: ObjectExpressionPath) {
  for (let current = configObject.parent; current; current = current.parent) {
    if (
      current.node.type === 'CallExpression' &&
      calleeName(current.node.callee) === 'mergeConfig'
    ) {
      return true;
    }
  }
  return false;
}

function calleeName(callee: jscodeshift.ASTNode) {
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  return callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
    ? callee.property.name
    : undefined;
}

/**
 * Vitest resolves relative `setupFiles` against the root of the project that runs them: the owning
 * project's `test.root`, then its `root`, then the same two fields of each config it inherits from,
 * and finally the config file's directory. An inherited root-level entry therefore resolves against
 * the inheriting project, not the root config. A root that can't be read statically makes every
 * entry unresolvable.
 */
function getSetupFilesBaseDir(
  setupFilesPath: ObjectPropertyPath,
  owner: ObjectExpressionPath | null,
  configFile: string
): { baseDir: string } | { unresolvedRoot: jscodeshift.ASTNode } {
  const configDir = path.dirname(configFile);
  const candidates: (jscodeshift.ASTNode | undefined)[] = [];
  const testRootOf = (configObject: jscodeshift.ObjectExpression) => {
    const testValue = findProperty(configObject, 'test')?.value;
    return testValue?.type === 'ObjectExpression'
      ? findProperty(testValue, 'root')?.value
      : undefined;
  };

  let configObject = owner ?? getEnclosingConfigObject(setupFilesPath);
  while (configObject) {
    candidates.push(testRootOf(configObject.node), findProperty(configObject.node, 'root')?.value);
    configObject = getEnclosingRootConfig(configObject);
  }

  const rootNode = candidates.find((candidate) => candidate !== undefined);
  if (!rootNode) {
    return { baseDir: configDir };
  }
  const root = resolveStaticPath(rootNode, configFile);
  return root === null ? { unresolvedRoot: rootNode } : { baseDir: path.resolve(configDir, root) };
}

function findProperty(objectNode: jscodeshift.ObjectExpression, name: string) {
  return objectNode.properties.find(
    (property): property is jscodeshift.ObjectProperty =>
      property.type === 'ObjectProperty' && isKeyNamed(property.key, name)
  );
}

/** From a `test.projects[n]` object to the root config object listing it, or null at the top. */
function getEnclosingRootConfig(configObject: ObjectExpressionPath): ObjectExpressionPath | null {
  const projectsProperty = configObject.parent?.parent;

  if (
    !projectsProperty ||
    projectsProperty.node.type !== 'ObjectProperty' ||
    !isKeyNamed(projectsProperty.node.key, 'projects')
  ) {
    return null;
  }

  return getEnclosingConfigObject(projectsProperty);
}

function resolveStaticPath(
  node: jscodeshift.ASTNode | null | undefined,
  configFile: string
): string | null {
  if (!node) {
    return null;
  }

  const configDir = path.dirname(configFile);

  if (node.type === 'StringLiteral') {
    return node.value;
  }

  if (node.type === 'TemplateLiteral') {
    if (node.expressions.length > 0 || node.quasis.length !== 1) {
      return null;
    }
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }

  if (node.type === 'Identifier' && node.name === '__dirname') {
    return configDir;
  }

  if (node.type === 'MemberExpression' && node.object.type === 'MetaProperty') {
    if (node.property.type === 'Identifier' && node.property.name === 'dirname') {
      return configDir;
    }
    return null;
  }

  if (node.type !== 'CallExpression') {
    return null;
  }

  if (calleeName(node.callee) === 'fileURLToPath') {
    const [argument] = node.arguments;
    if (node.arguments.length !== 1) {
      return null;
    }
    if (isImportMetaUrl(argument)) {
      return configFile;
    }
    if (argument.type === 'NewExpression' && calleeName(argument.callee) === 'URL') {
      const [relative, base] = argument.arguments;
      if (argument.arguments.length !== 2 || !isImportMetaUrl(base)) {
        return null;
      }
      const relativePath = resolveStaticPath(relative, configFile);
      return relativePath === null ? null : path.resolve(configDir, relativePath);
    }
    return null;
  }

  const pathMethod = getPathMethodName(node.callee);
  if (!pathMethod) {
    return null;
  }

  const segments: string[] = [];
  for (const argument of node.arguments) {
    const segment = resolveStaticPath(argument, configFile);
    if (segment === null) {
      return null;
    }
    segments.push(segment);
  }

  if (pathMethod === 'dirname') {
    return segments.length === 1 ? path.dirname(segments[0]) : null;
  }
  if (segments.length === 0) {
    return null;
  }
  return pathMethod === 'join' ? path.join(...segments) : path.resolve(...segments);
}

function isImportMetaUrl(node: jscodeshift.ASTNode | null | undefined): boolean {
  return (
    node?.type === 'MemberExpression' &&
    node.object.type === 'MetaProperty' &&
    node.property?.type === 'Identifier' &&
    node.property.name === 'url'
  );
}

function getPathMethodName(
  callee: jscodeshift.ASTNode | null | undefined
): 'join' | 'resolve' | 'dirname' | null {
  if (callee?.type !== 'MemberExpression' || callee.property?.type !== 'Identifier') {
    return null;
  }
  const method = callee.property.name;
  if (method !== 'join' && method !== 'resolve' && method !== 'dirname') {
    return null;
  }
  return callee.object?.type === 'Identifier' ? method : null;
}

function removeSetupFileEntries(
  source: string,
  configFile: string,
  targets: Set<string>,
  inheritsRootByDefault: ExtendsDefault
) {
  const j = jscodeshift.withParser('ts');
  const root = j(source);
  const pluginNames = getStorybookPluginNames(j, root);
  let changed = false;

  root
    .find(j.ObjectProperty)
    .filter((propertyPath) => isKeyNamed(propertyPath.value.key, 'setupFiles'))
    .forEach((propertyPath) => {
      const owners = getOwningConfigObjects(j, propertyPath, inheritsRootByDefault);
      const baseDirs = (owners === 'unknown' ? [] : owners)
        .filter(
          (owner) =>
            classifyConfigObject(j, owner, pluginNames, inheritsRootByDefault) === 'storybook'
        )
        .map((owner) => getSetupFilesBaseDir(propertyPath, owner, configFile))
        .flatMap((base) => ('baseDir' in base ? [base.baseDir] : []));
      const isTarget = (node: jscodeshift.ASTNode | null) => {
        const resolved = resolveStaticPath(node, configFile);
        return (
          resolved !== null &&
          baseDirs.some((baseDir) => targets.has(path.resolve(baseDir, resolved)))
        );
      };
      const value = propertyPath.value.value;

      if (value.type !== 'ArrayExpression') {
        if (isTarget(value)) {
          propertyPath.prune();
          changed = true;
        }
        return;
      }

      const kept = value.elements.filter((element) => !isTarget(element));
      if (kept.length === value.elements.length) {
        return;
      }
      changed = true;
      value.elements = kept;
      if (kept.length === 0) {
        propertyPath.prune();
      }
    });

  return changed ? root.toSource(PRINT_OPTIONS) : null;
}

function isKeyNamed(key: { type: string; name?: unknown; value?: unknown }, name: string) {
  return (
    (key.type === 'Identifier' && key.name === name) ||
    (key.type === 'StringLiteral' && key.value === name)
  );
}
