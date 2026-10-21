import { relative } from 'node:path';

import { parser, traverse, types as t } from 'storybook/internal/babel';
import { getProjectRoot } from 'storybook/internal/common';

import picocolors from 'picocolors';

import { isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import { type FileKind, collectFiles } from '../pipeline.ts';
import type { Fix } from '../types.ts';

const ADDON_THEMES = '@storybook/addon-themes';
const ADDON_THEMES_REACT = '@storybook/addon-themes-react';
const MOVED_NAMES = new Set(['withThemeFromJSXProvider', 'ProviderStrategyConfiguration']);
const REWRITTEN_KINDS: FileKind[] = ['main', 'preview', 'manager', 'config', 'story'];

const MIGRATION_LINK =
  'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#withthemefromjsxprovider-moved-to-storybookaddon-themes-react';

const MODULE_LINE =
  /^(?<statement>import|export)\s+(?<clause>[\s\S]+)\s+from\s+(?<quote>['"`])@storybook\/addon-themes\k<quote>\s*;?\s*(?:\/\/.*)?$/;
const SPECIFIER = /^(?:type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+[A-Za-z_$][\w$]*)?$/;
const MOVED_NAME = new RegExp(`\\b(?:${[...MOVED_NAMES].join('|')})\\b`);

type Edit = { start: number; end: number; text: string };

export interface AddonThemesJsxProviderResult {
  mixedImportLines?: { file: string; line: string }[];
}

const parse = (code: string) => {
  for (const plugins of [['typescript', 'jsx'], ['typescript']] as const) {
    try {
      return parser.parse(code, { sourceType: 'module', plugins: [...plugins] });
    } catch {}
  }
  return undefined;
};

const bindingName = (node: t.Identifier | t.StringLiteral) =>
  t.isIdentifier(node) ? node.name : node.value;

const quote = (code: string, literal: t.StringLiteral) => code[literal.start ?? 0] ?? "'";

const semicolon = (code: string, node: t.Node) => (code[(node.end ?? 1) - 1] === ';' ? ';' : '');

const finish = (code: string, node: t.Node, text: string) => `${text}${semicolon(code, node)}`;

const namedText = (code: string, specifiers: readonly t.Node[]) =>
  specifiers.map((specifier) => code.slice(specifier.start ?? 0, specifier.end ?? 0)).join(', ');

const importMoves = (specifier: t.ModuleSpecifier) =>
  t.isImportSpecifier(specifier) && MOVED_NAMES.has(bindingName(specifier.imported));

const exportMoves = (specifier: t.ExportNamedDeclaration['specifiers'][number]) =>
  t.isExportSpecifier(specifier) && MOVED_NAMES.has(bindingName(specifier.local));

const renderImport = (
  code: string,
  node: t.ImportDeclaration,
  specifiers: t.ImportDeclaration['specifiers'],
  source: string
) => {
  const typePrefix = node.importKind === 'type' ? 'type ' : '';
  const heads = specifiers.filter(
    (specifier) => t.isImportDefaultSpecifier(specifier) || t.isImportNamespaceSpecifier(specifier)
  );
  const named = specifiers.filter((specifier) => t.isImportSpecifier(specifier));
  const head = namedText(code, heads);
  const names = namedText(code, named);
  const clause = head && names ? `${head}, { ${names} }` : names ? `{ ${names} }` : head;
  const q = quote(code, node.source);
  return `import ${typePrefix}${clause} from ${q}${source}${q}`;
};

const renderExport = (
  code: string,
  node: t.ExportNamedDeclaration,
  specifiers: readonly t.Node[],
  source: string
) => {
  const typePrefix = node.exportKind === 'type' ? 'type ' : '';
  const q = quote(code, node.source!);
  return `export ${typePrefix}{ ${namedText(code, specifiers)} } from ${q}${source}${q}`;
};

const replaceModule = (literal: t.StringLiteral): Edit => ({
  start: (literal.start ?? 0) + 1,
  end: (literal.end ?? 0) - 1,
  text: ADDON_THEMES_REACT,
});

const replaceStatement = (code: string, node: t.Node, text: string): Edit => ({
  start: node.start ?? 0,
  end: node.end ?? 0,
  text: finish(code, node, text),
});

const applyEdits = (code: string, edits: Edit[]) =>
  edits
    .sort((left, right) => right.start - left.start)
    .reduce(
      (result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end),
      code
    );

const propertyName = (property: t.ObjectProperty) => {
  if (property.computed) {
    return undefined;
  }
  if (t.isIdentifier(property.key)) {
    return property.key.name;
  }
  if (t.isStringLiteral(property.key)) {
    return property.key.value;
  }
  return undefined;
};

const literalArgument = (node: t.Node | null | undefined) => {
  if (t.isStringLiteral(node)) {
    return node;
  }
  if (t.isTSLiteralType(node) && t.isStringLiteral(node.literal)) {
    return node.literal;
  }
  return undefined;
};

const specifierNames = (list: string) => {
  const names: string[] = [];
  for (const part of list.split(',')) {
    if (!part.trim()) {
      continue;
    }
    const match = part.trim().match(SPECIFIER);
    if (!match) {
      return undefined;
    }
    names.push(match[1]);
  }
  return names;
};

const classifyModuleLine = (line: string): 'rewrite' | 'mixed' | 'skip' => {
  const match = line.trim().match(MODULE_LINE);
  if (!match?.groups) {
    return 'skip';
  }
  let clause = match.groups.clause.trim();
  if (clause.startsWith('type ')) {
    clause = clause.slice('type '.length).trim();
  }
  if (match.groups.statement === 'export' && !clause.startsWith('{')) {
    return 'skip';
  }
  const open = clause.indexOf('{');
  const close = clause.lastIndexOf('}');
  const head = (open === -1 ? clause : clause.slice(0, open)).replace(/,\s*$/, '').trim();
  if (open !== -1 && close < open) {
    return 'skip';
  }
  const names = open === -1 ? [] : specifierNames(clause.slice(open + 1, close));
  if (!names) {
    return MOVED_NAME.test(clause) ? 'mixed' : 'skip';
  }
  const moved = names.filter((name) => MOVED_NAMES.has(name));
  if (moved.length === 0) {
    return 'skip';
  }
  return moved.length === names.length && !head ? 'rewrite' : 'mixed';
};

const rewriteUnparsed = (code: string) => {
  const mixedLines: string[] = [];
  let changed = false;
  const lines = code.split('\n').map((line) => {
    const ending = line.endsWith('\r') ? '\r' : '';
    const body = ending ? line.slice(0, -1) : line;
    const kind = classifyModuleLine(body);
    if (kind === 'mixed') {
      mixedLines.push(body.trim());
    }
    if (kind !== 'rewrite') {
      return line;
    }
    changed = true;
    return (
      body.replace(
        /(['"`])@storybook\/addon-themes\1(?=\s*;?\s*(?:\/\/.*)?$)/,
        `$1${ADDON_THEMES_REACT}$1`
      ) + ending
    );
  });
  return { code: changed ? lines.join('\n') : null, mixedLines };
};

const loadedModule = (init: t.Node | null | undefined) => {
  const expression = t.isAwaitExpression(init) ? init.argument : init;
  if (!t.isCallExpression(expression)) {
    return undefined;
  }
  const awaited = t.isAwaitExpression(init);
  const requireCall = !awaited && t.isIdentifier(expression.callee, { name: 'require' });
  const importCall = awaited && t.isImport(expression.callee);
  if (!requireCall && !importCall) {
    return undefined;
  }
  const source = literalArgument(expression.arguments[0]);
  return source ? { source, awaited } : undefined;
};

const splitPattern = (properties: t.ObjectPattern['properties']) => {
  const moved = properties.filter(
    (property) => t.isObjectProperty(property) && MOVED_NAMES.has(propertyName(property) ?? '')
  );
  return { moved, kept: properties.filter((property) => !moved.includes(property)) };
};

const rewriteJsxProviderImports = (code: string): string | null => rewriteModule(code).code;

const rewriteModule = (code: string): { code: string | null; mixedLines: string[] } => {
  const ast = parse(code);
  if (!ast) {
    return rewriteUnparsed(code);
  }

  const edits: Edit[] = [];
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value !== ADDON_THEMES) {
        return;
      }
      const moved = path.node.specifiers.filter(importMoves);
      if (moved.length === 0) {
        return;
      }
      if (moved.length === path.node.specifiers.length) {
        edits.push(replaceModule(path.node.source));
        return;
      }
      const kept = path.node.specifiers.filter((specifier) => !importMoves(specifier));
      edits.push(
        replaceStatement(
          code,
          path.node,
          `${finish(code, path.node, renderImport(code, path.node, kept, ADDON_THEMES))}\n${renderImport(code, path.node, moved, ADDON_THEMES_REACT)}`
        )
      );
    },
    ExportNamedDeclaration(path) {
      if (!path.node.source || path.node.source.value !== ADDON_THEMES) {
        return;
      }
      const moved = path.node.specifiers.filter(exportMoves);
      if (moved.length === 0) {
        return;
      }
      if (moved.length === path.node.specifiers.length) {
        edits.push(replaceModule(path.node.source));
        return;
      }
      const kept = path.node.specifiers.filter((specifier) => !exportMoves(specifier));
      edits.push(
        replaceStatement(
          code,
          path.node,
          `${finish(code, path.node, renderExport(code, path.node, kept, ADDON_THEMES))}\n${renderExport(code, path.node, moved, ADDON_THEMES_REACT)}`
        )
      );
    },
    VariableDeclarator(path) {
      const declaration = path.parentPath.node;
      if (
        !t.isVariableDeclaration(declaration) ||
        declaration.declarations.length !== 1 ||
        !t.isObjectPattern(path.node.id)
      ) {
        return;
      }
      const loaded = loadedModule(path.node.init);
      if (!loaded || loaded.source.value !== ADDON_THEMES) {
        return;
      }
      const { moved, kept } = splitPattern(path.node.id.properties);
      if (moved.length === 0) {
        return;
      }
      if (moved.length === path.node.id.properties.length) {
        edits.push(replaceModule(loaded.source));
        return;
      }
      const q = quote(code, loaded.source);
      const load = loaded.awaited ? 'await import' : 'require';
      const statement = (names: string, moduleName: string) =>
        `${declaration.kind} { ${names} } = ${load}(${q}${moduleName}${q})`;
      edits.push(
        replaceStatement(
          code,
          declaration,
          `${finish(code, declaration, statement(namedText(code, kept), ADDON_THEMES))}\n${statement(namedText(code, moved), ADDON_THEMES_REACT)}`
        )
      );
    },
    CallExpression(path) {
      const callee = path.node.callee;
      if (
        !t.isMemberExpression(callee) ||
        callee.computed ||
        !t.isIdentifier(callee.property, { name: 'then' }) ||
        !t.isCallExpression(callee.object) ||
        !t.isImport(callee.object.callee)
      ) {
        return;
      }
      const source = literalArgument(callee.object.arguments[0]);
      const callback = path.node.arguments[0];
      if (!source || source.value !== ADDON_THEMES) {
        return;
      }
      if (!t.isArrowFunctionExpression(callback) && !t.isFunctionExpression(callback)) {
        return;
      }
      const pattern = callback.params[0];
      if (!t.isObjectPattern(pattern)) {
        return;
      }
      const { moved } = splitPattern(pattern.properties);
      if (moved.length > 0 && moved.length === pattern.properties.length) {
        edits.push(replaceModule(source));
      }
    },
    TSImportType(path) {
      const source = literalArgument(path.node.argument as t.Node);
      const qualifier = path.node.qualifier;
      if (
        !source ||
        source.value !== ADDON_THEMES ||
        !t.isIdentifier(qualifier) ||
        !MOVED_NAMES.has(qualifier.name)
      ) {
        return;
      }
      edits.push(replaceModule(source));
    },
  });

  if (edits.length === 0) {
    return { code: null, mixedLines: [] };
  }
  const next = applyEdits(code, edits);
  return { code: next === code ? null : next, mixedLines: [] };
};

const promptSummary = () =>
  `Move ${picocolors.cyan('withThemeFromJSXProvider')} imports to ${picocolors.cyan(ADDON_THEMES_REACT)}`;

export const addonThemesJsxProvider: Fix<AddonThemesJsxProviderResult> = {
  id: 'addon-themes-jsx-provider',
  link: MIGRATION_LINK,

  prompt: (result) => {
    const lines = result?.mixedImportLines;
    if (!lines?.length) {
      return promptSummary();
    }
    const list = lines
      .map(({ file, line }) => `- ${relative(getProjectRoot(), file)}: ${line}`)
      .join('\n');
    return `${promptSummary()}\n\nSplit these imports by hand. They mix names that moved to ${picocolors.cyan(ADDON_THEMES_REACT)} with names that stay on ${picocolors.cyan(ADDON_THEMES)}, in a file the migration could not parse:\n${list}`;
  },

  async check({
    storybookVersion,
    configDir,
    mainConfigPath,
    previewConfigPath,
    storiesPaths,
    files,
  }) {
    if (!isAtOrPastVersion(storybookVersion, '11.0.0') || !configDir) {
      return null;
    }

    const projectFiles = await collectFiles(
      { configDir, mainConfigPath, previewConfigPath, storiesPaths },
      new Set(REWRITTEN_KINDS)
    );
    const mixedImportLines: NonNullable<AddonThemesJsxProviderResult['mixedImportLines']> = [];
    let changes = false;
    for (const { id } of projectFiles) {
      const found = rewriteModule(await files.read(id));
      if (found.code) {
        changes = true;
      }
      found.mixedLines.forEach((line) => mixedImportLines.push({ file: id, line }));
    }
    if (!changes && mixedImportLines.length === 0) {
      return null;
    }
    return mixedImportLines.length > 0 ? { mixedImportLines } : {};
  },

  transform: () => [
    {
      filter: { kind: REWRITTEN_KINDS, code: /@storybook\/addon-themes(?!-react)/ },
      handler: rewriteJsxProviderImports,
    },
  ],

  async run({ packageManager, storybookVersion }) {
    await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
      `${ADDON_THEMES_REACT}@${storybookVersion}`,
    ]);
  },
};
