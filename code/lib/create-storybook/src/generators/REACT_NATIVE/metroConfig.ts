import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { JsPackageManager } from 'storybook/internal/common';
import {
  type ESTree as E,
  type ESTreeNode as Node,
  SourceEditor,
  isStringLiteral,
  parseModule,
  walk,
} from 'storybook/internal/csf-tools';
import { logger, prompt } from 'storybook/internal/node-logger';

export const METRO_CONFIG_CANDIDATES = ['metro.config.ts', 'metro.config.js', 'metro.config.cjs'];
export const METRO_SETUP_DOCS_LINK =
  'https://storybookjs.github.io/react-native/docs/intro/configuration/metro-configuration';

export const METRO_FALLBACK_COMMENT_MARKER = 'storybook-react-native-metro-codemod-fallback';
export const EXPO_CREATE_METRO_COMMAND = {
  command: 'expo',
  args: ['customize', 'metro.config.js'] as string[],
} as const;

type MetroCodemodStatus =
  | 'updated'
  | 'already-configured'
  | 'skipped-existing-storybook-import'
  | 'skipped-missing-file'
  | 'fallback-commented';

export interface MetroCodemodResult {
  status: MetroCodemodStatus;
  filePath?: string;
  notes?: string[];
}

type TransformResult =
  | { action: 'updated'; code: string }
  | { action: 'already-configured' }
  | { action: 'unsupported' };

// Quote-anchored patterns used as a last-resort fallback when the AST parse fails.
// They are intentionally specific so that unrelated identifiers like
// `storybookEnabled` or `isStorybookMode` don't produce false positives.
const STORYBOOK_PACKAGE_PATTERNS = [
  "'@storybook/", // @storybook/* scoped packages (single-quoted)
  '"@storybook/', // @storybook/* scoped packages (double-quoted)
  "'storybook'", // bare 'storybook' package specifier
  '"storybook"', // bare "storybook" package specifier
  "'storybook/", // storybook/* sub-path (single-quoted)
  '"storybook/', // storybook/* sub-path (double-quoted)
];

const hasStorybookPackage = (value: string) => {
  return value === 'storybook' || value.startsWith('@storybook/') || value.startsWith('storybook/');
};

const isRequireOfStorybook = (node: Node) =>
  node.type === 'CallExpression' &&
  node.callee.type === 'Identifier' &&
  node.callee.name === 'require' &&
  isStringLiteral(node.arguments[0]) &&
  hasStorybookPackage(node.arguments[0].value);

const statementContainsStorybookCall = (statement: Node) => {
  let found = false;
  walk(statement, (node) => {
    if (found || isRequireOfStorybook(node)) {
      found = true;
      return false;
    }
  });
  return found;
};

const isModuleExportsTarget = (left: Node) => {
  return (
    left.type === 'MemberExpression' &&
    left.object.type === 'Identifier' &&
    left.object.name === 'module' &&
    left.property.type === 'Identifier' &&
    left.property.name === 'exports'
  );
};

const isWithStorybookCall = (node: Node, withStorybookLocalName: string) => {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === withStorybookLocalName
  );
};

const usesEsmSyntax = (program: E.Program) => {
  return program.body.some(
    (node) =>
      node.type === 'ImportDeclaration' ||
      node.type === 'ExportDefaultDeclaration' ||
      node.type === 'ExportNamedDeclaration' ||
      node.type === 'ExportAllDeclaration'
  );
};

export const containsStorybookImport = (source: string) => {
  try {
    const { program } = parseModule(source);
    for (const statement of program.body) {
      if (statement.type === 'ImportDeclaration' && hasStorybookPackage(statement.source.value)) {
        return true;
      }

      if (statement.type === 'ExportNamedDeclaration' && statement.source) {
        if (hasStorybookPackage(statement.source.value)) {
          return true;
        }
      }

      if (statementContainsStorybookCall(statement)) {
        return true;
      }
    }
  } catch {
    return STORYBOOK_PACKAGE_PATTERNS.some((pattern) => source.includes(pattern));
  }

  return false;
};

const hasWithStorybookBinding = (program: E.Program) => {
  for (const statement of program.body) {
    if (
      statement.type === 'ImportDeclaration' &&
      statement.source.value === '@storybook/react-native/withStorybook'
    ) {
      const withStorybookSpecifier = statement.specifiers.find(
        (specifier) =>
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === 'withStorybook'
      );
      if (withStorybookSpecifier) {
        return withStorybookSpecifier.local.name;
      }
    }

    if (statement.type !== 'VariableDeclaration') {
      continue;
    }

    for (const declaration of statement.declarations) {
      const { id, init } = declaration;
      if (
        id.type !== 'ObjectPattern' ||
        init?.type !== 'CallExpression' ||
        init.callee.type !== 'Identifier' ||
        init.callee.name !== 'require'
      ) {
        continue;
      }

      const [firstArgument] = init.arguments;
      if (
        !isStringLiteral(firstArgument) ||
        firstArgument.value !== '@storybook/react-native/withStorybook'
      ) {
        continue;
      }

      for (const property of id.properties) {
        if (
          property.type === 'Property' &&
          property.key.type === 'Identifier' &&
          property.key.name === 'withStorybook' &&
          property.value.type === 'Identifier'
        ) {
          return property.value.name;
        }
      }
    }
  }

  return undefined;
};

// Where a statement inserted at the top of the file goes: after the directive prologue and after a
// file-leading pragma comment (// @ts-nocheck, /* eslint-disable */), but above the other comments
// of the first statement.
const getTopInsertionPosition = (editor: SourceEditor) => {
  const { body } = editor.program;
  const firstStatement = body.find(
    (statement) =>
      !(statement.type === 'ExpressionStatement' && isStringLiteral(statement.expression))
  );
  if (!firstStatement) {
    return undefined;
  }
  const previousEnd = body[body.indexOf(firstStatement) - 1]?.end ?? 0;
  const leadingComment = editor.comments.find(
    (comment) =>
      comment.start > 0 && comment.start >= previousEnd && comment.end <= firstStatement.start
  );
  return leadingComment?.start ?? firstStatement.start;
};

const injectWithStorybookImport = (editor: SourceEditor, useEsmImport: boolean) => {
  const { body } = editor.program;
  const lastImport = body.findLast((statement) => statement.type === 'ImportDeclaration');
  if (useEsmImport && lastImport) {
    editor.edits.appendLeft(lastImport.end, `\n${WITH_STORYBOOK_IMPORT}`);
    return;
  }

  const statement = useEsmImport ? WITH_STORYBOOK_IMPORT : WITH_STORYBOOK_REQUIRE;
  const position = getTopInsertionPosition(editor);
  if (position === undefined) {
    editor.edits.append(`\n${statement}\n`);
    return;
  }
  editor.edits.appendRight(position, `${statement}\n\n`);
};

const WITH_STORYBOOK_IMPORT =
  "import { withStorybook } from '@storybook/react-native/withStorybook';";
const WITH_STORYBOOK_REQUIRE =
  "const { withStorybook } = require('@storybook/react-native/withStorybook');";

export const prependMetroFallbackComment = (source: string) => {
  if (source.includes(METRO_FALLBACK_COMMENT_MARKER)) {
    return source;
  }

  return `/**\n * ${METRO_FALLBACK_COMMENT_MARKER}\n * Storybook could not automatically update this Metro config file.\n * Please follow the manual setup instructions:\n * ${METRO_SETUP_DOCS_LINK}\n */\n${source}`;
};

export const transformMetroConfigSource = (source: string, filePath: string): TransformResult => {
  const editor = new SourceEditor(source);
  const { program } = editor;
  const withStorybookLocalName = hasWithStorybookBinding(program) ?? 'withStorybook';
  let matchedExport = false;
  let changed = false;

  const wrap = (node: Node) => {
    editor.edits.appendRight(node.start, `${withStorybookLocalName}(`);
    editor.edits.appendLeft(node.end, ')');
    changed = true;
  };

  for (const statement of program.body) {
    if (
      statement.type === 'ExpressionStatement' &&
      statement.expression.type === 'AssignmentExpression'
    ) {
      if (!isModuleExportsTarget(statement.expression.left)) {
        continue;
      }

      matchedExport = true;
      if (isWithStorybookCall(statement.expression.right, withStorybookLocalName)) {
        return { action: 'already-configured' };
      }

      wrap(statement.expression.right);
      continue;
    }

    if (statement.type !== 'ExportDefaultDeclaration') {
      continue;
    }

    matchedExport = true;
    const { declaration } = statement;

    // A function declaration's source is also a valid function expression.
    if (declaration.type === 'FunctionDeclaration' && declaration.body) {
      wrap(declaration);
      continue;
    }

    if (
      declaration.type === 'FunctionDeclaration' ||
      declaration.type === 'ClassDeclaration' ||
      declaration.type === 'TSInterfaceDeclaration' ||
      declaration.type === 'TSDeclareFunction'
    ) {
      return { action: 'unsupported' };
    }

    if (isWithStorybookCall(declaration, withStorybookLocalName)) {
      return { action: 'already-configured' };
    }

    wrap(declaration);
  }

  if (!matchedExport) {
    return { action: 'unsupported' };
  }

  if (!changed) {
    return { action: 'already-configured' };
  }

  if (!hasWithStorybookBinding(program)) {
    const shouldUseEsmImport = usesEsmSyntax(program) || filePath.endsWith('.mjs');
    injectWithStorybookImport(editor, shouldUseEsmImport);
  }

  return { action: 'updated', code: editor.toString() };
};

const pathExists = async (value: string) => {
  try {
    await access(value);
    return true;
  } catch {
    return false;
  }
};

const detectMetroCandidates = async () => {
  const candidates: string[] = [];
  for (const fileName of METRO_CONFIG_CANDIDATES) {
    const absolutePath = path.resolve(process.cwd(), fileName);
    if (await pathExists(absolutePath)) {
      candidates.push(absolutePath);
    }
  }

  return candidates;
};

const createExpoMetroConfigHelper = async (packageManager: JsPackageManager) => {
  try {
    await packageManager.runPackageCommand({
      args: [EXPO_CREATE_METRO_COMMAND.command, ...EXPO_CREATE_METRO_COMMAND.args],
      cwd: process.cwd(),
    });
    return true;
  } catch (error) {
    logger.warn(`Failed to create Expo Metro config automatically: ${String(error)}`);
    return false;
  }
};

const resolveMetroConfigPath = async ({
  packageManager,
  yes,
}: {
  packageManager: JsPackageManager;
  yes: boolean;
}) => {
  let candidates = await detectMetroCandidates();

  if (candidates.length === 0 && packageManager.getDependencyVersion('expo')) {
    const created = await createExpoMetroConfigHelper(packageManager);
    if (created) {
      candidates = await detectMetroCandidates();
    }
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length > 1) {
    if (yes) {
      logger.warn(
        `Multiple Metro config files detected. Non-interactive mode selected ${path.relative(
          process.cwd(),
          candidates[0]
        )}.`
      );
      return candidates[0];
    }

    const selected = await prompt.select({
      message: 'Multiple Metro config files found. Which one should Storybook update?',
      options: candidates.map((candidate) => ({
        label: path.relative(process.cwd(), candidate),
        value: candidate,
      })),
    });
    return String(selected);
  }

  if (yes) {
    return null;
  }

  const answer = await prompt.text({
    message:
      'No Metro config file was found. Enter the path to your Metro config file to update, or leave blank to skip.',
  });

  const normalized = String(answer || '').trim();
  if (!normalized) {
    return null;
  }

  const resolved = path.isAbsolute(normalized)
    ? normalized
    : path.resolve(process.cwd(), normalized.replace(/^\.\//, ''));

  if (await pathExists(resolved)) {
    return resolved;
  }

  logger.warn(`Provided Metro config path does not exist: ${normalized}`);
  return null;
};

export const runMetroCodemodOrFallback = async ({
  packageManager,
  yes,
}: {
  packageManager: JsPackageManager;
  yes: boolean;
}): Promise<MetroCodemodResult> => {
  const filePath = await resolveMetroConfigPath({ packageManager, yes });
  if (!filePath) {
    return {
      status: 'skipped-missing-file',
      notes: ['No Metro config file was selected for automatic modification.'],
    };
  }

  const source = await readFile(filePath, 'utf-8');

  if (containsStorybookImport(source)) {
    return {
      status: 'skipped-existing-storybook-import',
      filePath,
      notes: ['Storybook import detected in Metro config; leaving file unchanged.'],
    };
  }

  try {
    const transformResult = transformMetroConfigSource(source, filePath);

    if (transformResult.action === 'already-configured') {
      return {
        status: 'already-configured',
        filePath,
        notes: ['Metro config already appears to be wrapped with withStorybook.'],
      };
    }

    if (transformResult.action === 'unsupported') {
      const fallbackSource = prependMetroFallbackComment(source);
      if (fallbackSource !== source) {
        await writeFile(filePath, fallbackSource, 'utf-8');
      }
      return {
        status: 'fallback-commented',
        filePath,
        notes: ['Could not apply automated codemod; added guidance comment at top of file.'],
      };
    }

    if (transformResult.code !== source) {
      await writeFile(filePath, transformResult.code, 'utf-8');
    }

    return {
      status: 'updated',
      filePath,
      notes: ['Metro config was updated with withStorybook wrapper.'],
    };
  } catch (error) {
    const fallbackSource = prependMetroFallbackComment(source);
    if (fallbackSource !== source) {
      await writeFile(filePath, fallbackSource, 'utf-8');
    }

    return {
      status: 'fallback-commented',
      filePath,
      notes: [`Metro codemod encountered an error: ${String(error)}`],
    };
  }
};
