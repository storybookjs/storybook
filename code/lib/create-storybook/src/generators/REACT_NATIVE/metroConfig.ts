import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parser, recast, types as t } from 'storybook/internal/babel';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

export const METRO_CONFIG_CANDIDATES = ['metro.config.ts', 'metro.config.js', 'metro.config.cjs'];
export const METRO_SETUP_DOCS_LINK = 'TODO_REPLACE_WITH_REACT_NATIVE_METRO_DOCS_LINK';
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

const STORYBOOK_PACKAGE_PATTERNS = ['@storybook/', 'storybook', 'storybook/'];

const hasStorybookPackage = (value: string) => {
  return value === 'storybook' || value.startsWith('@storybook/') || value.startsWith('storybook/');
};

const isModuleExportsTarget = (left: t.LVal | t.OptionalMemberExpression) => {
  return (
    t.isMemberExpression(left) &&
    t.isIdentifier(left.object, { name: 'module' }) &&
    t.isIdentifier(left.property, { name: 'exports' })
  );
};

const isWithStorybookCall = (node: t.Node | null | undefined) => {
  return t.isCallExpression(node) && t.isIdentifier(node.callee, { name: 'withStorybook' });
};

const parseConfig = (source: string) => {
  return recast.parse(source, {
    parser: {
      parse(code: string) {
        return parser.parse(code, {
          sourceType: 'unambiguous',
          plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties'],
        });
      },
    },
  }) as t.File;
};

const usesEsmSyntax = (program: t.Program) => {
  return program.body.some(
    (node) =>
      t.isImportDeclaration(node) ||
      t.isExportDefaultDeclaration(node) ||
      t.isExportNamedDeclaration(node) ||
      t.isExportAllDeclaration(node)
  );
};

export const containsStorybookImport = (source: string) => {
  try {
    const ast = parseConfig(source);
    for (const statement of ast.program.body) {
      if (t.isImportDeclaration(statement) && hasStorybookPackage(statement.source.value)) {
        return true;
      }

      if (!t.isVariableDeclaration(statement)) {
        continue;
      }

      for (const declaration of statement.declarations) {
        if (!t.isCallExpression(declaration.init)) {
          continue;
        }

        if (!t.isIdentifier(declaration.init.callee, { name: 'require' })) {
          continue;
        }

        const [firstArgument] = declaration.init.arguments;
        if (t.isStringLiteral(firstArgument) && hasStorybookPackage(firstArgument.value)) {
          return true;
        }
      }
    }
  } catch {
    return STORYBOOK_PACKAGE_PATTERNS.some((pattern) => source.includes(pattern));
  }

  return false;
};

const hasWithStorybookBinding = (program: t.Program) => {
  for (const statement of program.body) {
    if (
      t.isImportDeclaration(statement) &&
      statement.source.value === '@storybook/react-native/withStorybook'
    ) {
      return statement.specifiers.some(
        (specifier) =>
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported, { name: 'withStorybook' })
      );
    }

    if (!t.isVariableDeclaration(statement)) {
      continue;
    }

    for (const declaration of statement.declarations) {
      if (!t.isObjectPattern(declaration.id) || !t.isCallExpression(declaration.init)) {
        continue;
      }

      if (!t.isIdentifier(declaration.init.callee, { name: 'require' })) {
        continue;
      }

      const [firstArgument] = declaration.init.arguments;
      if (!t.isStringLiteral(firstArgument)) {
        continue;
      }

      if (firstArgument.value !== '@storybook/react-native/withStorybook') {
        continue;
      }

      const withStorybookProperty = declaration.id.properties.find(
        (property) =>
          t.isObjectProperty(property) &&
          t.isIdentifier(property.key, { name: 'withStorybook' }) &&
          t.isIdentifier(property.value, { name: 'withStorybook' })
      );

      if (withStorybookProperty) {
        return true;
      }
    }
  }

  return false;
};

// Returns the index in program.body after any directive-prologue statements
// (ExpressionStatement nodes whose expression is a StringLiteral, e.g. 'use strict',
// 'use client') so that injected imports are never inserted before them.
// Babel normally stores these in program.directives rather than program.body, but
// we guard defensively for configurations that leave them as body nodes.
const getBodyInsertionIndex = (program: t.Program): number => {
  for (let i = 0; i < program.body.length; i++) {
    const statement = program.body[i];
    if (t.isExpressionStatement(statement) && t.isStringLiteral(statement.expression)) {
      continue;
    }
    return i;
  }
  return program.body.length;
};

// Babel nodes don't expose comment arrays in their public types; define a minimal
// shape for the two comment storage formats used by Babel and recast respectively.
interface ASTComment {
  start?: number;
  leading?: boolean;
}

interface NodeWithComments extends t.Node {
  /** recast: comment objects with {leading, trailing} boolean flags */
  comments?: ASTComment[];
  /** Babel: leading-only comments (no {leading} flag needed) */
  leadingComments?: ASTComment[];
}

// Move file-level leading comments (those that start at source position 0) from
// `fromNode` to `toNode` so that pragmas like // @ts-nocheck, /* eslint-disable */,
// and // @flow remain the very first content in the printed file even after a new
// import/require statement is inserted before them.
// recast stores comments in both node.comments (with {leading, trailing} flags) and
// node.leadingComments; we update both so the printer sees the change.
const shiftFileLeadingComments = (fromNode: t.Node, toNode: t.Node) => {
  const from = fromNode as NodeWithComments;
  const to = toNode as NodeWithComments;

  const isFileLeading = (c: ASTComment) => typeof c.start === 'number' && c.start === 0;

  // recast-style: node.comments[{leading: true, ...}]
  if (Array.isArray(from.comments)) {
    const fileLeading = from.comments.filter((c) => c.leading && isFileLeading(c));
    if (fileLeading.length > 0) {
      to.comments = [...fileLeading, ...(to.comments ?? [])];
      from.comments = from.comments.filter((c) => !(c.leading && isFileLeading(c)));
    }
  }

  // Babel-style: node.leadingComments[]
  if (Array.isArray(from.leadingComments)) {
    const fileLeading = from.leadingComments.filter(isFileLeading);
    if (fileLeading.length > 0) {
      to.leadingComments = [...fileLeading, ...(to.leadingComments ?? [])];
      from.leadingComments = from.leadingComments.filter((c) => !isFileLeading(c));
    }
  }
};

const injectWithStorybookImport = (program: t.Program, useEsmImport: boolean) => {
  if (useEsmImport) {
    const importDeclaration = t.importDeclaration(
      [t.importSpecifier(t.identifier('withStorybook'), t.identifier('withStorybook'))],
      t.stringLiteral('@storybook/react-native/withStorybook')
    );
    const lastImportIndex = [...program.body]
      .reverse()
      .findIndex((statement) => t.isImportDeclaration(statement));

    if (lastImportIndex === -1) {
      const insertAt = getBodyInsertionIndex(program);
      const nodeAtInsert = program.body[insertAt];
      if (nodeAtInsert) {
        shiftFileLeadingComments(nodeAtInsert, importDeclaration);
      }
      program.body.splice(insertAt, 0, importDeclaration);
      return;
    }

    const insertAfter = program.body.length - lastImportIndex;
    program.body.splice(insertAfter, 0, importDeclaration);
    return;
  }

  const requireDeclaration = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.objectPattern([
        t.objectProperty(t.identifier('withStorybook'), t.identifier('withStorybook'), false, true),
      ]),
      t.callExpression(t.identifier('require'), [
        t.stringLiteral('@storybook/react-native/withStorybook'),
      ])
    ),
  ]);
  const insertAt = getBodyInsertionIndex(program);
  const nodeAtInsert = program.body[insertAt];
  if (nodeAtInsert) {
    shiftFileLeadingComments(nodeAtInsert, requireDeclaration);
  }
  program.body.splice(insertAt, 0, requireDeclaration);
};

export const prependMetroFallbackComment = (source: string) => {
  if (source.includes(METRO_FALLBACK_COMMENT_MARKER)) {
    return source;
  }

  return `/**\n * ${METRO_FALLBACK_COMMENT_MARKER}\n * Storybook could not automatically update this Metro config file.\n * Please follow the manual setup instructions:\n * ${METRO_SETUP_DOCS_LINK}\n */\n${source}`;
};

export const transformMetroConfigSource = (source: string, filePath: string): TransformResult => {
  const ast = parseConfig(source);
  const program = ast.program;
  let matchedExport = false;
  let changed = false;

  for (const statement of program.body) {
    if (t.isExpressionStatement(statement) && t.isAssignmentExpression(statement.expression)) {
      if (!isModuleExportsTarget(statement.expression.left)) {
        continue;
      }

      matchedExport = true;
      if (isWithStorybookCall(statement.expression.right)) {
        return { action: 'already-configured' };
      }

      statement.expression.right = t.callExpression(t.identifier('withStorybook'), [
        statement.expression.right as t.Expression,
      ]);
      changed = true;
      continue;
    }

    if (!t.isExportDefaultDeclaration(statement)) {
      continue;
    }

    matchedExport = true;

    if (t.isFunctionDeclaration(statement.declaration)) {
      const functionExpression = t.functionExpression(
        statement.declaration.id,
        statement.declaration.params,
        statement.declaration.body,
        statement.declaration.generator,
        statement.declaration.async
      );
      // Preserve TypeScript/Flow function metadata when converting declaration -> expression.
      functionExpression.returnType = statement.declaration.returnType ?? null;
      functionExpression.typeParameters = statement.declaration.typeParameters ?? null;
      statement.declaration = t.callExpression(t.identifier('withStorybook'), [functionExpression]);
      changed = true;
      continue;
    }

    if (!t.isExpression(statement.declaration)) {
      return { action: 'unsupported' };
    }

    if (isWithStorybookCall(statement.declaration)) {
      return { action: 'already-configured' };
    }

    statement.declaration = t.callExpression(t.identifier('withStorybook'), [
      statement.declaration,
    ]);
    changed = true;
  }

  if (!matchedExport) {
    return { action: 'unsupported' };
  }

  if (!changed) {
    return { action: 'already-configured' };
  }

  if (!hasWithStorybookBinding(program)) {
    const shouldUseEsmImport = usesEsmSyntax(program) || filePath.endsWith('.mjs');
    injectWithStorybookImport(program, shouldUseEsmImport);
  }

  return {
    action: 'updated',
    code: recast.print(ast, {
      quote: 'single',
      trailingComma: true,
      tabWidth: 2,
      wrapColumn: 100,
    }).code,
  };
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
