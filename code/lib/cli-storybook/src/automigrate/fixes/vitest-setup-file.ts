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

interface VitestSetupFileOptions {
  setupFiles: VitestSetupFileInfo[];
  configFiles: string[];
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
    for (const configFile of candidateConfigFiles) {
      try {
        const source = readFileSync(configFile, 'utf8');
        for (const entry of extractSetupFileEntries(source)) {
          const resolvedPath = path.resolve(path.dirname(configFile), entry);
          if (existsSync(resolvedPath)) {
            candidateSetupFiles.add(resolvedPath);
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

    const configFiles = candidateConfigFiles.filter((configFile) => {
      try {
        const source = readFileSync(configFile, 'utf8');
        return extractSetupFileEntries(source).some((entry) =>
          setupFilePaths.has(path.resolve(path.dirname(configFile), entry))
        );
      } catch {
        return false;
      }
    });

    return { setupFiles, configFiles };
  },

  prompt() {
    return `We'll remove your legacy Vitest setup file that applies project annotations, as ${VITEST_ADDON_NAME} now applies them automatically`;
  },

  async run({ result, dryRun }) {
    const { setupFiles, configFiles } = result;

    const nonRewritableFiles = setupFiles.filter((setupFile) => !setupFile.isRewritable);
    if (nonRewritableFiles.length > 0) {
      const files = nonRewritableFiles.map(
        (setupFile, index) =>
          dedent`
          ${index + 1}) ${picocolors.cyan(setupFile.path)}: ${setupFile.reason}
        `
      );

      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(
        dedent`
        The ${this.id} automigration couldn't migrate your Vitest setup file(s) automatically, but here are instructions for doing it yourself:

        ${files.join('\n\n')}

        Since Storybook 10.3, ${picocolors.cyan(VITEST_ADDON_NAME)} applies your project annotations automatically. From Storybook 11.0 it always does, so your setup file runs in addition to that. Calls to ${picocolors.cyan('setProjectAnnotations')} compose additively, so nothing breaks, but the boilerplate is redundant:

        ${picocolors.gray('- setProjectAnnotations([projectAnnotations]);')}

        For each file listed above:
          1. If the ${picocolors.cyan('setProjectAnnotations')} call only re-applies your ${picocolors.cyan('.storybook')} preview, remove the call — the addon now does this for you.
          2. If you pass extra annotations (e.g. from an addon's preview), keep them: they compose with the automatic ones.
          3. If nothing else remains in the file, delete it and remove its entry from the ${picocolors.cyan('setupFiles')} array in your Vitest config.

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

      const { code, changed } = removeSetupFileEntries(source, (entry) =>
        setupFiles.some(
          (setupFile) => path.resolve(path.dirname(configFile), entry) === setupFile.path
        )
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

/** Collects the string entries of every `setupFiles` array in a Vitest/Vite/workspace config. */
export function extractSetupFileEntries(source: string): string[] {
  const j = jscodeshift.withParser('ts');
  const entries: string[] = [];

  j(source)
    .find(j.ObjectProperty)
    .filter((propertyPath) => isSetupFilesPropertyKey(propertyPath.value.key))
    .forEach((propertyPath) => {
      const value = propertyPath.value.value;
      if (value.type === 'StringLiteral') {
        entries.push(value.value);
        return;
      }
      if (value.type === 'ArrayExpression') {
        value.elements.forEach((element) => {
          if (element?.type === 'StringLiteral') {
            entries.push(element.value);
          }
        });
      }
    });

  return entries;
}

/**
 * Removes entries resolving to one of the setup files from every `setupFiles` array in the
 * config, and drops the property entirely when a string-valued `setupFiles` or an emptied array
 * pointed at them. Recast preserves the surrounding formatting.
 */
export function removeSetupFileEntries(source: string, isTargetEntry: (entry: string) => boolean) {
  const j = jscodeshift.withParser('ts');
  const root = j(source);
  let changed = false;

  root
    .find(j.ObjectProperty)
    .filter((propertyPath) => isSetupFilesPropertyKey(propertyPath.value.key))
    .forEach((propertyPath) => {
      const value = propertyPath.value.value;

      if (value.type === 'StringLiteral') {
        if (isTargetEntry(value.value)) {
          propertyPath.prune();
          changed = true;
        }
        return;
      }

      if (value.type !== 'ArrayExpression') {
        return;
      }

      const elements = value.elements;
      if (
        !elements.some(
          (element) => element?.type === 'StringLiteral' && isTargetEntry(element.value)
        )
      ) {
        return;
      }

      value.elements = elements.filter(
        (element) => !(element?.type === 'StringLiteral' && isTargetEntry(element.value))
      );
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
