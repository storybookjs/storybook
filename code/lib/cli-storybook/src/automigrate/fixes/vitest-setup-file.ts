import { existsSync } from 'fs';

import {
  formatExistingFile,
  frameworkPackages,
  getAddonNames,
  rendererPackages,
} from 'storybook/internal/common';
import {
  type ESTree as E,
  type ESTreeNode as Node,
  SourceEditor,
  arrayList,
  isStringLiteral,
  objectList,
  objectProperty,
  removeFromList,
  removeStatements,
  setImportSpecifiers,
  staticKey,
  walk,
} from 'storybook/internal/csf-tools';

import path from 'path';
import picocolors from 'picocolors';
import semver from 'semver';
import { dedent } from 'ts-dedent';

import { findFilesUp } from '../../util.ts';
import type { Fix } from '../types.ts';

const VITEST_ADDON_NAME = '@storybook/addon-vitest';
const VITEST_PLUGIN_MODULE = '@storybook/addon-vitest/vitest-plugin';
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
        // `check` read the file through another `files`; this read lets the commit keep the
        // file's line endings and notice when it changed on disk since.
        await files.edit(setupFile, () => formatExistingFile(setupFile, transform.code));
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
  let editor: SourceEditor;

  try {
    editor = new SourceEditor(source, options.setupFilePath);
  } catch {
    return { kind: 'manual', reason: 'it could not be parsed' };
  }

  const { program } = editor;

  const bindings = new Map<
    string,
    { declaration: E.ImportDeclaration; specifier: E.ImportDeclaration['specifiers'][number] }
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

  const unsupportedAnnotation = (node: Node) => ({
    kind: 'manual' as const,
    reason: `it passes annotations that are neither your ".storybook/preview" nor "${A11Y_PREVIEW_MODULE}": ${editor.source(node)}`,
  });

  const annotationName = (
    node: E.ArrayExpressionElement
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
      return unsupportedAnnotation(node!);
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
    return unsupportedAnnotation(node!);
  };

  const removedStatements = new Set<Node>();
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
      capturedNames.add((statement.declarations[0].id as E.BindingIdentifier).name);
    }
  }

  if (countReferences(program, callBinding[0]) !== removedStatements.size) {
    return {
      kind: 'manual',
      reason:
        'the "setProjectAnnotations" call is conditional or wrapped, so it cannot be removed safely',
    };
  }

  for (const name of capturedNames) {
    const forwardings = program.body.filter((statement) => isBeforeAllForwarding(statement, name));

    if (countReferences(program, name) !== forwardings.length) {
      return {
        kind: 'manual',
        reason:
          'the value returned by "setProjectAnnotations" is used for more than forwarding "beforeAll"',
      };
    }

    forwardings.forEach((statement) => removedStatements.add(statement));
  }

  const keptSpecifiers = new Map<E.ImportDeclaration, E.ImportDeclaration['specifiers']>();

  for (const name of [callBinding[0], ...annotationNames, 'beforeAll']) {
    const binding = bindings.get(name);

    if (!binding || countReferences(program, name, removedStatements) > 0) {
      continue;
    }

    const kept = (keptSpecifiers.get(binding.declaration) ?? binding.declaration.specifiers).filter(
      (specifier) => specifier !== binding.specifier
    );
    keptSpecifiers.set(binding.declaration, kept);

    if (kept.length === 0) {
      removedStatements.add(binding.declaration);
    }
  }

  if (program.body.every((statement) => removedStatements.has(statement))) {
    return { kind: 'empty' };
  }

  for (const [declaration, kept] of keptSpecifiers) {
    if (kept.length > 0) {
      setImportSpecifiers(editor, declaration, kept);
    }
  }
  removeStatements(editor, removedStatements);

  return { kind: 'rewritten', code: editor.toString() };
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

function isCallOf(node: Node | null | undefined, calleeName: string): node is E.CallExpression {
  return (
    node?.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === calleeName
  );
}

function isBeforeAllForwarding(statement: Node, resultName: string) {
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
function countReferences(
  program: E.Program,
  name: string,
  excluded: ReadonlySet<Node> = new Set()
) {
  let references = 0;
  walk(program, (node, parent) => {
    if (excluded.has(node)) {
      return false;
    }
    if (node.type !== 'Identifier' || node.name !== name || !parent) {
      return;
    }
    if (
      parent.type === 'ImportSpecifier' ||
      parent.type === 'ImportDefaultSpecifier' ||
      parent.type === 'ImportNamespaceSpecifier' ||
      (parent.type === 'VariableDeclarator' && parent.id === node)
    ) {
      return;
    }
    if (parent.type === 'MemberExpression' && !parent.computed && parent.property === node) {
      return;
    }
    if (
      parent.type === 'Property' &&
      !parent.computed &&
      parent.key === node &&
      !parent.shorthand
    ) {
      return;
    }
    references += 1;
  });
  return references;
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
  const editor = new SourceEditor(source, configFile);
  const pluginNames = getStorybookPluginNames(editor.program);
  const entries: SetupFileEntry[] = [];

  for (const property of findSetupFilesProperties(editor)) {
    const { value } = property;
    const nodes: (Node | null)[] = value.type === 'ArrayExpression' ? value.elements : [value];

    // A root-level `setupFiles` is listed once per inheriting project, each resolved against
    // that project's root, so one inherited by a Storybook and a plain project surfaces as both
    const owners = getOwningConfigObjects(editor, property, inheritsRootByDefault);
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
        ? classifyConfigObject(editor, owner, pluginNames, inheritsRootByDefault)
        : 'unknown';
      const base = getSetupFilesBaseDir(editor, property, owner, configFile);
      if ('unresolvedRoot' in base) {
        collect({
          kind: 'unresolved',
          expression: `root: ${editor.source(base.unresolvedRoot)}`,
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
            ? { kind: 'unresolved', expression: editor.source(node), project }
            : { kind: 'resolved', path: path.resolve(base.baseDir, resolved), project }
        );
      }
    }
  }

  return entries;
}

function findSetupFilesProperties(editor: SourceEditor) {
  const properties: E.ObjectProperty[] = [];
  walk(editor.program, (node) => {
    if (node.type === 'Property' && !node.method && staticKey(node) === 'setupFiles') {
      properties.push(node);
    }
  });
  return properties;
}

function getStorybookPluginNames(program: E.Program) {
  const names = new Set<string>();
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.source.value !== VITEST_PLUGIN_MODULE) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.imported.type === 'Identifier' &&
        specifier.imported.name === 'storybookTest'
      ) {
        names.add(specifier.local.name);
      } else if (specifier.type === 'ImportNamespaceSpecifier') {
        names.add('storybookTest');
      }
    }
  }
  return names;
}

// Vitest never runs a root config's `test` options as a project once `projects` is set; its
// `setupFiles` only reach the inline projects that inherit it, which therefore own them. A project
// that may inherit it is counted in, so an uncertain default errs toward reporting a shared file.
// Projects the fix can't read (a variable, a call, a spread) make the owners `unknown`; file-based
// projects (glob strings) don't inherit the root `test` options and are left out.
function getOwningConfigObjects(
  editor: SourceEditor,
  setupFiles: E.ObjectProperty,
  inheritsRootByDefault: ExtendsDefault
): E.ObjectExpression[] | 'unknown' {
  const configObject = getEnclosingConfigObject(editor, setupFiles);
  if (configObject === null) {
    return 'unknown';
  }
  const testValue = objectProperty(configObject, 'test')?.value;
  const projects =
    testValue?.type === 'ObjectExpression'
      ? objectProperty(testValue, 'projects')?.value
      : undefined;
  if (getEnclosingRootConfig(editor, configObject) !== null || projects === undefined) {
    return [configObject];
  }
  if (
    projects.type !== 'ArrayExpression' ||
    projects.elements.some(
      (element) => element?.type !== 'ObjectExpression' && !isStringLiteral(element)
    )
  ) {
    return 'unknown';
  }

  const inheritingProjects = projects.elements.filter(
    (element): element is E.ObjectExpression =>
      element?.type === 'ObjectExpression' &&
      inheritsRootConfig(element, inheritsRootByDefault) !== false
  );
  return inheritingProjects.length > 0 ? inheritingProjects : 'unknown';
}

// A path in `extends` inherits that file rather than the root config
function inheritsRootConfig(
  configObject: E.ObjectExpression,
  inheritsRootByDefault: ExtendsDefault
): boolean | 'path' | 'unknown' {
  const extendsValue = objectProperty(configObject, 'extends')?.value;
  if (!extendsValue) {
    return inheritsRootByDefault;
  }
  return extendsValue.type === 'Literal' && typeof extendsValue.value === 'boolean'
    ? extendsValue.value
    : 'path';
}

/** Walks from a property of a `test: {}` object up to the project or root config object owning it. */
function getEnclosingConfigObject(
  editor: SourceEditor,
  testField: E.ObjectProperty
): E.ObjectExpression | null {
  const testObject = editor.parentOf(testField);
  const testProperty = testObject && editor.parentOf(testObject);
  if (testProperty?.type !== 'Property' || staticKey(testProperty) !== 'test') {
    return null;
  }
  const configObject = editor.parentOf(testProperty);
  return configObject?.type === 'ObjectExpression' ? configObject : null;
}

function classifyConfigObject(
  editor: SourceEditor,
  configObject: E.ObjectExpression,
  pluginNames: Set<string>,
  inheritsRootByDefault: ExtendsDefault
): ProjectKind {
  const plugins = objectProperty(configObject, 'plugins')?.value;
  if (plugins && callsStorybookPlugin(plugins, pluginNames)) {
    return 'storybook';
  }
  if (
    plugins &&
    (plugins.type !== 'ArrayExpression' ||
      plugins.elements.some((element) => element?.type === 'SpreadElement'))
  ) {
    return 'unknown';
  }

  const own: ProjectKind = isMergedConfig(editor, configObject) ? 'unknown' : 'plain';
  const rootConfig = getEnclosingRootConfig(editor, configObject);
  if (rootConfig === null) {
    return own;
  }

  const inherits = inheritsRootConfig(configObject, inheritsRootByDefault);
  if (inherits === 'path') {
    return 'unknown';
  }
  if (inherits === false) {
    return own;
  }
  const inherited = classifyConfigObject(editor, rootConfig, pluginNames, inheritsRootByDefault);
  if (inherits === true) {
    return inherited;
  }
  // The default is not known, which only matters when inheriting would change the answer
  return inherited === own ? own : 'unknown';
}

function callsStorybookPlugin(plugins: Node, pluginNames: Set<string>) {
  let found = false;
  walk(plugins, (node) => {
    found ||= node.type === 'CallExpression' && pluginNames.has(calleeName(node.callee) ?? '');
  });
  return found;
}

function isMergedConfig(editor: SourceEditor, configObject: E.ObjectExpression) {
  for (let current = editor.parentOf(configObject); current; current = editor.parentOf(current)) {
    if (current.type === 'CallExpression' && calleeName(current.callee) === 'mergeConfig') {
      return true;
    }
  }
  return false;
}

function calleeName(callee: Node) {
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
  editor: SourceEditor,
  setupFiles: E.ObjectProperty,
  owner: E.ObjectExpression | null,
  configFile: string
): { baseDir: string } | { unresolvedRoot: Node } {
  const configDir = path.dirname(configFile);
  const candidates: (Node | undefined)[] = [];
  const testRootOf = (configObject: E.ObjectExpression) => {
    const testValue = objectProperty(configObject, 'test')?.value;
    return testValue?.type === 'ObjectExpression'
      ? objectProperty(testValue, 'root')?.value
      : undefined;
  };

  let configObject = owner ?? getEnclosingConfigObject(editor, setupFiles);
  while (configObject) {
    candidates.push(testRootOf(configObject), objectProperty(configObject, 'root')?.value);
    configObject = getEnclosingRootConfig(editor, configObject);
  }

  const rootNode = candidates.find((candidate) => candidate !== undefined);
  if (!rootNode) {
    return { baseDir: configDir };
  }
  const root = resolveStaticPath(rootNode, configFile);
  return root === null ? { unresolvedRoot: rootNode } : { baseDir: path.resolve(configDir, root) };
}

/** From a `test.projects[n]` object to the root config object listing it, or null at the top. */
function getEnclosingRootConfig(
  editor: SourceEditor,
  configObject: E.ObjectExpression
): E.ObjectExpression | null {
  const projectsArray = editor.parentOf(configObject);
  const projectsProperty = projectsArray && editor.parentOf(projectsArray);

  if (projectsProperty?.type !== 'Property' || staticKey(projectsProperty) !== 'projects') {
    return null;
  }

  return getEnclosingConfigObject(editor, projectsProperty);
}

function resolveStaticPath(node: Node | null | undefined, configFile: string): string | null {
  if (!node) {
    return null;
  }

  const configDir = path.dirname(configFile);

  if (isStringLiteral(node)) {
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

function isImportMetaUrl(node: Node | null | undefined): boolean {
  return (
    node?.type === 'MemberExpression' &&
    node.object.type === 'MetaProperty' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'url'
  );
}

function getPathMethodName(callee: Node): 'join' | 'resolve' | 'dirname' | null {
  if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') {
    return null;
  }
  const method = callee.property.name;
  if (method !== 'join' && method !== 'resolve' && method !== 'dirname') {
    return null;
  }
  return callee.object.type === 'Identifier' ? method : null;
}

function removeSetupFileEntries(
  source: string,
  configFile: string,
  targets: Set<string>,
  inheritsRootByDefault: ExtendsDefault
) {
  const editor = new SourceEditor(source, configFile);
  const pluginNames = getStorybookPluginNames(editor.program);

  for (const property of findSetupFilesProperties(editor)) {
    const owners = getOwningConfigObjects(editor, property, inheritsRootByDefault);
    const baseDirs = (owners === 'unknown' ? [] : owners)
      .filter(
        (owner) =>
          classifyConfigObject(editor, owner, pluginNames, inheritsRootByDefault) === 'storybook'
      )
      .map((owner) => getSetupFilesBaseDir(editor, property, owner, configFile))
      .flatMap((base) => ('baseDir' in base ? [base.baseDir] : []));
    const isTarget = (node: Node | null) => {
      const resolved = resolveStaticPath(node, configFile);
      return (
        resolved !== null &&
        baseDirs.some((baseDir) => targets.has(path.resolve(baseDir, resolved)))
      );
    };
    const { value } = property;
    const removeProperty = () =>
      removeFromList(editor, objectList(editor, editor.parentOf(property) as E.ObjectExpression), [
        property,
      ]);

    if (value.type !== 'ArrayExpression') {
      if (isTarget(value)) {
        removeProperty();
      }
      continue;
    }

    const removed = value.elements.filter((element): element is E.Expression => isTarget(element));
    if (removed.length > 0 && removed.length === value.elements.length) {
      removeProperty();
    } else if (removed.length > 0) {
      removeFromList(editor, arrayList(editor, value), removed);
    }
  }

  return editor.commit() ? editor.toString() : null;
}
