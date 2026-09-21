import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';

import { formatFileContent, frameworkPackages } from 'storybook/internal/common';
import { loadConfig } from 'storybook/internal/csf-tools';

import jscodeshift from 'jscodeshift';
import path from 'path';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { types as t } from 'storybook/internal/babel';

import { findFilesUp } from '../../util.ts';
import type { Fix } from '../types.ts';

const VITEST_ADDON_NAME = '@storybook/addon-vitest' as const;

const SETUP_FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.cts', '.mts', '.cjs', '.mjs'];

const CONFIG_FILE_PATTERNS = [
  'vitest.config.{js,ts,mjs,cjs}',
  'vitest.workspace.{js,ts,mjs,cjs}',
  'vite.config.{js,ts,mjs,cjs}',
];

interface VitestSetupFileInfo {
  path: string;
  /** Whether the file matches the shape the pre-10.3 postinstall generated, i.e. safe to delete. */
  isRewritable: boolean;
  /** Why the file can't be rewritten automatically; null when rewritable. */
  reason: string | null;
}

/** A `setupFiles` entry whose path could not be determined without executing the config. */
interface UnresolvedSetupEntry {
  configFile: string;
  expression: string;
}

interface VitestSetupFileOptions {
  setupFiles: VitestSetupFileInfo[];
  configFiles: string[];
  /** Entries we refuse to guess at; surfaced to the user instead of being silently skipped. */
  unresolvedEntries: UnresolvedSetupEntry[];
}

/**
 * The pre-10.3 postinstall generated `.storybook/vitest.setup.*` files containing a
 * `setProjectAnnotations` call, because the addon did not provision project annotations itself.
 * Since Storybook 10.3 the addon applies them via its own internal setup file, so the generated
 * boilerplate is redundant: this fix deletes those files and removes their `setupFiles` entries
 * from the Vitest/Vite config or workspace files that reference them.
 */
export const vitestSetupFile: Fix<VitestSetupFileOptions> = {
  id: 'vitest-setup-file',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-project-annotations-are-always-applied',

  promptType: 'auto',

  async check({ packageManager, configDir, hasCsfFactoryPreview }) {
    if (hasCsfFactoryPreview || !configDir) {
      return null;
    }

    // A leftover setup file is only ours to migrate when the addon is installed; without it the
    // file may be the only thing applying annotations for plain portable-stories setups.
    if (!(await packageManager.isPackageInstalled(VITEST_ADDON_NAME))) {
      return null;
    }

    const candidateConfigFiles = findFilesUp(CONFIG_FILE_PATTERNS, packageManager.instanceDir);

    const candidateSetupFiles = new Set<string>();

    // The pre-10.3 postinstall generated the setup file into configDir
    for (const extension of SETUP_FILE_EXTENSIONS) {
      const filePath = path.join(configDir, `vitest.setup${extension}`);
      if (existsSync(filePath)) {
        candidateSetupFiles.add(filePath);
      }
    }

    // Setup files can also live outside configDir, referenced from `test.setupFiles` entries
    const unresolvedEntries: UnresolvedSetupEntry[] = [];
    const entriesByConfigFile = new Map<string, SetupFileEntry[]>();
    for (const configFile of candidateConfigFiles) {
      try {
        const source = readFileSync(configFile, 'utf8');
        const entries = extractSetupFileEntries(source, configFile);
        entriesByConfigFile.set(configFile, entries);
        for (const entry of entries) {
          if (entry.kind === 'unresolved') {
            unresolvedEntries.push({ configFile, expression: entry.expression });
          } else if (existsSync(entry.path)) {
            candidateSetupFiles.add(entry.path);
          }
        }
      } catch {
        // Skip config files that can't be read or parsed
      }
    }

    const setupFiles: VitestSetupFileInfo[] = [];
    for (const filePath of candidateSetupFiles) {
      let source: string;
      try {
        source = readFileSync(filePath, 'utf8');
      } catch {
        continue;
      }

      if (!source.includes('setProjectAnnotations')) {
        continue;
      }

      setupFiles.push({ path: filePath, ...analyzeSetupFileShape(source) });
    }

    if (setupFiles.length === 0) {
      return null;
    }

    const setupFilePaths = new Set(setupFiles.map((setupFile) => setupFile.path));

    const configFiles = candidateConfigFiles.filter((configFile) =>
      entriesByConfigFile
        .get(configFile)
        ?.some((entry) => entry.kind === 'resolved' && setupFilePaths.has(entry.path))
    );

    return { setupFiles, configFiles, unresolvedEntries };
  },

  prompt() {
    return `We'll remove your legacy Vitest setup file that applies project annotations, as ${VITEST_ADDON_NAME} now applies them automatically`;
  },

  async run({ result, dryRun }) {
    const { setupFiles, configFiles, unresolvedEntries } = result;

    const problems = [
      ...setupFiles
        .filter((setupFile) => !setupFile.isRewritable)
        .map((setupFile) => `${picocolors.cyan(setupFile.path)}: ${setupFile.reason}`),
      // An entry we couldn't resolve may well be the reference to a file we are about to delete,
      // so we stop rather than leave the config pointing at a missing setup file.
      ...unresolvedEntries.map(
        (entry) =>
          `${picocolors.cyan(entry.configFile)}: the ${picocolors.cyan('setupFiles')} entry ${picocolors.gray(entry.expression)} is computed at runtime, so it can't be matched without executing your config`
      ),
    ];

    if (problems.length > 0) {
      const files = problems.map((problem, index) => `${index + 1}) ${problem}`);

      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(
        dedent`
        The ${this.id} automigration couldn't migrate your Vitest setup file(s) automatically, but here are instructions for doing it yourself:

        ${files.join('\n\n')}

        Since Storybook 10.3, ${picocolors.cyan(VITEST_ADDON_NAME)} applies your project annotations automatically. From Storybook 11.0 it always does, and its setup file runs before yours. Because ${picocolors.cyan('setProjectAnnotations')} replaces the project annotations instead of adding to them, a leftover call discards what the addon applied:

        ${picocolors.gray('- setProjectAnnotations([projectAnnotations]);')}

        For each file listed above:
          1. If the ${picocolors.cyan('setProjectAnnotations')} call only re-applies your ${picocolors.cyan('.storybook')} preview, remove the call — the addon now does this for you.
          2. If you pass extra annotations (e.g. from an addon's preview), move them into your ${picocolors.cyan('.storybook')} preview and then remove the call. ${picocolors.cyan('setProjectAnnotations')} replaces the annotations set by the addon instead of adding to them, so a leftover call silently drops them.
          3. If nothing else remains in the file, delete it and remove its entry from the ${picocolors.cyan('setupFiles')} array in your Vitest config.

        For any ${picocolors.cyan('setupFiles')} entry listed above: check where it points. If it resolves to a setup file that only re-applies your preview, delete that file and remove the entry.

        Read more: ${this.link}
      `
      );
    }

    for (const setupFile of setupFiles) {
      if (!dryRun) {
        unlinkSync(setupFile.path);
      }
    }

    for (const configFile of configFiles) {
      const source = readFileSync(configFile, 'utf8');

      const { code, changed } = removeSetupFileEntries(source, configFile, (resolvedPath) =>
        setupFiles.some((setupFile) => resolvedPath === setupFile.path)
      );

      if (!changed) {
        continue;
      }

      // The rewritten config must still parse before we write it back
      loadConfig(code, configFile);

      if (!dryRun) {
        writeFileSync(configFile, await formatFileContent(configFile, code), 'utf8');
      }
    }
  },
};

/**
 * Recognizes the shape the pre-10.3 postinstall generated: a `setProjectAnnotations` import from
 * the framework package, an optional standard `./preview` import, and one plain call whose
 * argument is an array of identifiers (possibly empty). Anything else is left alone, because
 * rewriting it could silently drop custom annotations.
 */
function analyzeSetupFileShape(source: string): {
  isRewritable: boolean;
  reason: string | null;
} {
  const j = jscodeshift.withParser('ts');
  // jscodeshift's `get()` is untyped; the parse of a setup file always yields a File/Program.
  const statements: t.Program['body'] = j(source).get().node.program.body;

  const importDeclarations = statements.filter(
    (statement) => statement.type === 'ImportDeclaration'
  );
  const nonImportStatements = statements.filter(
    (statement) => statement.type !== 'ImportDeclaration' && statement.type !== 'EmptyStatement'
  );

  if (nonImportStatements.length !== 1) {
    return {
      isRewritable: false,
      reason: 'it must contain a single "setProjectAnnotations" call and nothing else',
    };
  }

  const [callStatement] = nonImportStatements;
  if (
    callStatement.type !== 'ExpressionStatement' ||
    callStatement.expression.type !== 'CallExpression'
  ) {
    return {
      isRewritable: false,
      reason: 'the call is conditional or wrapped, so it cannot be removed safely',
    };
  }

  const call = callStatement.expression;
  if (call.callee.type !== 'Identifier' || call.callee.name !== 'setProjectAnnotations') {
    return {
      isRewritable: false,
      reason: 'the call is aliased or wrapped, so it cannot be removed safely',
    };
  }

  const [callArgument] = call.arguments;
  if (call.arguments.length !== 1 || callArgument.type !== 'ArrayExpression') {
    return {
      isRewritable: false,
      reason: 'the call passes unexpected arguments (e.g. inline objects or multiple arguments)',
    };
  }

  const elements = callArgument.elements;
  if (elements.some((element) => !element || element.type !== 'Identifier')) {
    return {
      isRewritable: false,
      reason: 'the call passes inline objects or addon annotation modules',
    };
  }

  for (const importDeclaration of importDeclarations) {
    const importSource = importDeclaration.source.value;
    if (typeof importSource !== 'string') {
      return { isRewritable: false, reason: 'it contains an unexpected import' };
    }

    const specifiers = importDeclaration.specifiers;
    const isPreviewImport =
      importSource === './preview' &&
      specifiers.length === 1 &&
      specifiers[0].type === 'ImportNamespaceSpecifier';

    const isFrameworkImport =
      specifiers.length === 1 &&
      specifiers[0].type === 'ImportSpecifier' &&
      specifiers[0].imported.type === 'Identifier' &&
      specifiers[0].imported.name === 'setProjectAnnotations' &&
      specifiers[0].local.name === 'setProjectAnnotations' &&
      (importSource === 'storybook' || importSource in frameworkPackages);

    if (!isPreviewImport && !isFrameworkImport) {
      return {
        isRewritable: false,
        reason: `it imports "${importSource}", which is not part of the generated boilerplate`,
      };
    }
  }

  return { isRewritable: true, reason: null };
}

/**
 * A single `setupFiles` entry. Entries are expressions, not necessarily literals, so an entry is
 * either statically resolved to an absolute path or reported verbatim as unresolved — never
 * silently dropped, because a skipped entry can leave a deleted setup file referenced.
 */
export type SetupFileEntry =
  | { kind: 'resolved'; path: string }
  | { kind: 'unresolved'; expression: string };

/**
 * Collects the entries of every `setupFiles` value in a Vitest/Vite/workspace config, resolving
 * each against the config's directory.
 *
 * Only these forms are recognized: string literals, template literals without substitutions, and
 * `path.join`/`path.resolve`/`path.dirname` chains over them anchored on `import.meta.dirname`,
 * `__dirname`, or `fileURLToPath(...)` of `import.meta.url`. Everything else — a variable, a
 * function call, a conditional, a spread — is returned as `unresolved` rather than matched,
 * because resolving it would mean executing the user's config.
 */
export function extractSetupFileEntries(source: string, configFile: string): SetupFileEntry[] {
  const j = jscodeshift.withParser('ts');
  const entries: SetupFileEntry[] = [];

  const collect = (node: jscodeshift.ASTNode) => {
    entries.push(toSetupFileEntry(j, node, configFile));
  };

  j(source)
    .find(j.ObjectProperty)
    .filter((propertyPath) => isSetupFilesPropertyKey(propertyPath.value.key))
    .forEach((propertyPath) => {
      const value = propertyPath.value.value;
      if (value.type === 'ArrayExpression') {
        value.elements.forEach((element) => element && collect(element));
        return;
      }
      collect(value);
    });

  return entries;
}

/** Resolves one entry node, falling back to its printed source when it can't be resolved. */
function toSetupFileEntry(
  j: jscodeshift.JSCodeshift,
  node: jscodeshift.ASTNode,
  configFile: string
): SetupFileEntry {
  const resolved = resolveStaticPath(node, configFile);
  if (resolved !== null) {
    return { kind: 'resolved', path: path.resolve(path.dirname(configFile), resolved) };
  }
  return { kind: 'unresolved', expression: printExpression(j, node) };
}

/** Prints an expression back to source so unresolved entries can be quoted to the user. */
function printExpression(j: jscodeshift.JSCodeshift, node: jscodeshift.ASTNode): string {
  try {
    return j(node).toSource();
  } catch {
    return String(node.type);
  }
}

/**
 * Statically evaluates the path-building idioms commonly found in `setupFiles`, without executing
 * any user code. Returns null as soon as any part of the expression is not statically known.
 */
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

  // `\`./.storybook/vitest.setup.ts\`` — but not once a substitution makes it dynamic
  if (node.type === 'TemplateLiteral') {
    if (node.expressions.length > 0 || node.quasis.length !== 1) {
      return null;
    }
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }

  // `__dirname`
  if (node.type === 'Identifier' && node.name === '__dirname') {
    return configDir;
  }

  // `import.meta.dirname` / `import.meta.url`
  if (node.type === 'MemberExpression' && isImportMeta(node.object)) {
    if (node.property.type === 'Identifier' && node.property.name === 'dirname') {
      return configDir;
    }
    // `import.meta.url` is only a path once passed through `fileURLToPath`, handled below
    return null;
  }

  if (node.type !== 'CallExpression') {
    return null;
  }

  // `fileURLToPath(import.meta.url)` and `fileURLToPath(new URL('.', import.meta.url))`
  if (isCalleeNamed(node.callee, 'fileURLToPath')) {
    const [argument] = node.arguments;
    if (node.arguments.length !== 1 || !argument) {
      return null;
    }
    if (isImportMetaUrl(argument)) {
      return configFile;
    }
    if (argument.type === 'NewExpression' && isCalleeNamed(argument.callee, 'URL')) {
      const [relative, base] = argument.arguments;
      if (argument.arguments.length !== 2 || !isImportMetaUrl(base)) {
        return null;
      }
      const relativePath = resolveStaticPath(relative, configFile);
      return relativePath === null ? null : path.resolve(configDir, relativePath);
    }
    return null;
  }

  // `path.join(...)` / `path.resolve(...)` / `path.dirname(...)`
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

function isImportMeta(node: jscodeshift.ASTNode | null | undefined): boolean {
  return node?.type === 'MetaProperty' || (node?.type === 'Identifier' && node.name === 'import');
}

function isImportMetaUrl(node: jscodeshift.ASTNode | null | undefined): boolean {
  return (
    node?.type === 'MemberExpression' &&
    isImportMeta(node.object) &&
    node.property?.type === 'Identifier' &&
    node.property.name === 'url'
  );
}

/** Matches a bare `fn(...)` or an imported-namespace `ns.fn(...)` callee. */
function isCalleeNamed(callee: jscodeshift.ASTNode | null | undefined, name: string): boolean {
  if (callee?.type === 'Identifier') {
    return callee.name === name;
  }
  return (
    callee?.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === name
  );
}

/** Matches `path.join`-style callees, including `node:path` default and namespace imports. */
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
  // Accept any single-identifier namespace (`path`, `nodePath`, ...); a wrong guess still only
  // produces a path string, which must match an existing setup file to have any effect.
  return callee.object?.type === 'Identifier' ? method : null;
}

/**
 * Removes entries resolving to one of the setup files from every `setupFiles` value in the
 * config, and drops the property entirely when a single-valued `setupFiles` or an emptied array
 * pointed at them. Recast preserves the surrounding formatting.
 *
 * Only statically resolvable entries are matched — see {@link extractSetupFileEntries}. Entries
 * that cannot be resolved are left in place and reported to the user by the caller.
 */
export function removeSetupFileEntries(
  source: string,
  configFile: string,
  isTargetPath: (resolvedPath: string) => boolean
) {
  const j = jscodeshift.withParser('ts');
  const root = j(source);
  let changed = false;

  const isTargetNode = (node: jscodeshift.ASTNode) => {
    const entry = toSetupFileEntry(j, node, configFile);
    return entry.kind === 'resolved' && isTargetPath(entry.path);
  };

  root
    .find(j.ObjectProperty)
    .filter((propertyPath) => isSetupFilesPropertyKey(propertyPath.value.key))
    .forEach((propertyPath) => {
      const value = propertyPath.value.value;

      if (value.type !== 'ArrayExpression') {
        if (isTargetNode(value)) {
          propertyPath.prune();
          changed = true;
        }
        return;
      }

      const elements = value.elements;
      if (!elements.some((element) => element && isTargetNode(element))) {
        return;
      }

      value.elements = elements.filter((element) => !(element && isTargetNode(element)));
      changed = true;

      if (value.elements.length === 0) {
        propertyPath.prune();
      }
    });

  return { code: root.toSource(), changed };
}

/** Matches `setupFiles` property keys, identifier or string-keyed. */
function isSetupFilesPropertyKey(key: { type: string; name?: unknown; value?: unknown }) {
  return (
    (key.type === 'Identifier' && key.name === 'setupFiles') ||
    (key.type === 'StringLiteral' && key.value === 'setupFiles')
  );
}
