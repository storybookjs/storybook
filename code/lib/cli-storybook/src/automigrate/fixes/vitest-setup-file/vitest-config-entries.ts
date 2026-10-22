import jscodeshift from 'jscodeshift';
import path from 'path';

export const VITEST_PLUGIN_MODULE = '@storybook/addon-vitest/vitest-plugin';

// Recast defaults this to `os.EOL`, which would carriage-return printed files on Windows.
export const PRINT_OPTIONS = { lineTerminator: '\n' };

// What a project without an `extends` property does: Vitest 5 inherits the root config unless the
// project opts out, Vitest 4 only inherits with `extends: true`. `unknown` when no Vitest is found.
export type ExtendsDefault = boolean | 'unknown';

// Whether the Vitest project owning a `setupFiles` entry loads the `storybookTest` plugin. It is
// `unknown` when the plugins come from somewhere the fix can't read: `mergeConfig`, a path in
// `extends`, or a spread `plugins` array.
export type ProjectKind = 'storybook' | 'plain' | 'unknown';

/**
 * A `setupFiles` entry, either statically resolved to an absolute path or reported verbatim so a
 * deleted setup file never stays referenced by an entry the fix could not read. `project` tells
 * whether the project (or root config) owning the entry loads the `storybookTest` plugin.
 */
export type SetupFileEntry =
  | { kind: 'resolved'; path: string; project: ProjectKind }
  | { kind: 'unresolved'; expression: string; project: ProjectKind };

export function extractSetupFileEntries(
  source: string,
  configFile: string,
  inheritsRootByDefault: ExtendsDefault,
  storybookConfigDir: string,
  instanceDir: string
): SetupFileEntry[] {
  const j = jscodeshift.withParser('ts');
  const root = j(source);
  const pluginNames = getStorybookPluginNames(j, root);
  const defaultBaseDir = defaultSetupFilesBaseDir(configFile, storybookConfigDir, instanceDir);
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
        const base = getSetupFilesBaseDir(propertyPath, owner, configFile, defaultBaseDir);
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
 * The directory relative `setupFiles` entries resolve against when a config declares no explicit
 * root: the config file's directory — unless the config lives in the Storybook config dir, which
 * is only loaded explicitly (`vitest run --config .storybook/vitest.config.ts`), so its relative
 * entries resolve against the invocation cwd instead. That cwd is the config dir's parent, as long
 * as the config dir sits strictly inside the directory Vitest runs from; when the Storybook config
 * dir IS that directory (`-c .`, or a package whose root holds `main.ts`), the config file's
 * directory is the invocation cwd itself, and using the parent would point above the project root.
 */
function defaultSetupFilesBaseDir(
  configFile: string,
  storybookConfigDir: string,
  instanceDir: string
): string {
  const configFileDir = path.dirname(configFile);
  const isInsideConfigDir =
    configFileDir === storybookConfigDir ||
    configFileDir.startsWith(`${storybookConfigDir}${path.sep}`);
  if (!isInsideConfigDir) {
    return configFileDir;
  }
  const parentDir = path.dirname(storybookConfigDir);
  const parentInsideInstanceDir =
    parentDir === instanceDir || parentDir.startsWith(`${instanceDir}${path.sep}`);
  return storybookConfigDir !== instanceDir && parentInsideInstanceDir ? parentDir : configFileDir;
}

/**
 * Vitest resolves relative `setupFiles` against the root of the project that runs them: the owning
 * project's `test.root`, then its `root`, then the same two fields of each config it inherits from,
 * and finally `defaultBaseDir`. An inherited root-level entry therefore resolves against the
 * inheriting project, not the root config. A root that can't be read statically makes every entry
 * unresolvable.
 */
function getSetupFilesBaseDir(
  setupFilesPath: ObjectPropertyPath,
  owner: ObjectExpressionPath | null,
  configFile: string,
  defaultBaseDir: string
): { baseDir: string } | { unresolvedRoot: jscodeshift.ASTNode } {
  const configFileDir = path.dirname(configFile);
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
    return { baseDir: defaultBaseDir };
  }
  const root = resolveStaticPath(rootNode, configFile);
  return root === null
    ? { unresolvedRoot: rootNode }
    : { baseDir: path.resolve(configFileDir, root) };
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

export function removeSetupFileEntries(
  source: string,
  configFile: string,
  targets: Set<string>,
  inheritsRootByDefault: ExtendsDefault,
  storybookConfigDir: string,
  instanceDir: string
) {
  const j = jscodeshift.withParser('ts');
  const root = j(source);
  const pluginNames = getStorybookPluginNames(j, root);
  const defaultBaseDir = defaultSetupFilesBaseDir(configFile, storybookConfigDir, instanceDir);
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
        .map((owner) => getSetupFilesBaseDir(propertyPath, owner, configFile, defaultBaseDir))
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
