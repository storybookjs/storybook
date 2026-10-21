import { relative } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';
import {
  type ESTree as E,
  isStringLiteral,
  parseModule,
  restoreLineEndings,
  walk,
} from 'storybook/internal/csf-tools';

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

const bindingName = (node: E.ModuleExportName) =>
  node.type === 'Literal' ? node.value : node.name;

const quote = (code: string, literal: E.StringLiteral) => code[literal.start] ?? "'";

const semicolon = (code: string, node: E.Span) => (code[node.end - 1] === ';' ? ';' : '');

const finish = (code: string, node: E.Span, text: string) => `${text}${semicolon(code, node)}`;

const namedText = (code: string, specifiers: readonly E.Span[]) =>
  specifiers.map((specifier) => code.slice(specifier.start, specifier.end)).join(', ');

const importMoves = (specifier: E.ImportDeclarationSpecifier) =>
  specifier.type === 'ImportSpecifier' && MOVED_NAMES.has(bindingName(specifier.imported));

const exportMoves = (specifier: E.ExportSpecifier) => MOVED_NAMES.has(bindingName(specifier.local));

const renderImport = (
  code: string,
  node: E.ImportDeclaration,
  specifiers: E.ImportDeclaration['specifiers'],
  source: string
) => {
  const typePrefix = node.importKind === 'type' ? 'type ' : '';
  const heads = specifiers.filter(
    (specifier) =>
      specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportNamespaceSpecifier'
  );
  const named = specifiers.filter((specifier) => specifier.type === 'ImportSpecifier');
  const head = namedText(code, heads);
  const names = namedText(code, named);
  const clause = head && names ? `${head}, { ${names} }` : names ? `{ ${names} }` : head;
  const q = quote(code, node.source);
  return `import ${typePrefix}${clause} from ${q}${source}${q}`;
};

const renderExport = (
  code: string,
  node: E.ExportNamedDeclaration,
  specifiers: readonly E.Span[],
  source: string
) => {
  const typePrefix = node.exportKind === 'type' ? 'type ' : '';
  const q = quote(code, node.source!);
  return `export ${typePrefix}{ ${namedText(code, specifiers)} } from ${q}${source}${q}`;
};

const replaceModule = (literal: E.StringLiteral): Edit => ({
  start: literal.start + 1,
  end: literal.end - 1,
  text: ADDON_THEMES_REACT,
});

const replaceStatement = (code: string, node: E.Span, text: string): Edit => ({
  start: node.start,
  end: node.end,
  text: finish(code, node, text),
});

const applyEdits = (code: string, edits: Edit[]) =>
  edits
    .sort((left, right) => right.start - left.start)
    .reduce(
      (result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end),
      code
    );

const propertyName = (property: E.BindingProperty) => {
  if (property.computed) {
    return undefined;
  }
  if (property.key.type === 'Identifier') {
    return property.key.name;
  }
  if (isStringLiteral(property.key)) {
    return property.key.value;
  }
  return undefined;
};

const stringLiteral = (node: E.Node | null | undefined) =>
  isStringLiteral(node) ? node : undefined;

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

const loadedModule = (init: E.Expression | null | undefined) => {
  const awaited = init?.type === 'AwaitExpression';
  const expression = awaited ? init.argument : init;
  if (
    !awaited &&
    expression?.type === 'CallExpression' &&
    expression.callee.type === 'Identifier' &&
    expression.callee.name === 'require'
  ) {
    const source = stringLiteral(expression.arguments[0]);
    return source ? { source, awaited: false as const } : undefined;
  }
  if (expression?.type === 'ImportExpression') {
    const source = stringLiteral(expression.source);
    return source ? { source, awaited: true as const } : undefined;
  }
  return undefined;
};

const splitPattern = (properties: E.ObjectPattern['properties']) => {
  const isMoved = (
    property: E.ObjectPattern['properties'][number]
  ): property is E.BindingProperty => {
    if (property.type !== 'Property') {
      return false;
    }
    return MOVED_NAMES.has(propertyName(property) ?? '');
  };
  return {
    moved: properties.filter(isMoved),
    kept: properties.filter((property) => !isMoved(property)),
  };
};

const rewriteJsxProviderImports = (code: string): string | null => rewriteModule(code).code;

const rewriteModule = (code: string): { code: string | null; mixedLines: string[] } => {
  let parsed: ReturnType<typeof parseModule> | undefined;
  try {
    parsed = parseModule(code);
  } catch {
    return rewriteUnparsed(code);
  }
  const source = parsed.code;

  const edits: Edit[] = [];
  walk(parsed.program, (node, parent) => {
    if (node.type === 'ImportDeclaration') {
      if (node.source.value !== ADDON_THEMES) {
        return;
      }
      const moved = node.specifiers.filter(importMoves);
      if (moved.length === 0) {
        return;
      }
      if (moved.length === node.specifiers.length) {
        edits.push(replaceModule(node.source));
        return;
      }
      const kept = node.specifiers.filter((specifier) => !importMoves(specifier));
      edits.push(
        replaceStatement(
          source,
          node,
          `${finish(source, node, renderImport(source, node, kept, ADDON_THEMES))}\n${renderImport(source, node, moved, ADDON_THEMES_REACT)}`
        )
      );
      return;
    }
    if (node.type === 'ExportNamedDeclaration') {
      if (node.source?.value !== ADDON_THEMES) {
        return;
      }
      const moved = node.specifiers.filter(exportMoves);
      if (moved.length === 0) {
        return;
      }
      if (moved.length === node.specifiers.length) {
        edits.push(replaceModule(node.source));
        return;
      }
      const kept = node.specifiers.filter((specifier) => !exportMoves(specifier));
      edits.push(
        replaceStatement(
          source,
          node,
          `${finish(source, node, renderExport(source, node, kept, ADDON_THEMES))}\n${renderExport(source, node, moved, ADDON_THEMES_REACT)}`
        )
      );
      return;
    }
    if (
      node.type === 'VariableDeclarator' &&
      parent?.type === 'VariableDeclaration' &&
      parent.declarations.length === 1 &&
      node.id.type === 'ObjectPattern'
    ) {
      const declaration = parent;
      const loaded = loadedModule(node.init);
      if (!loaded || loaded.source.value !== ADDON_THEMES) {
        return;
      }
      const { moved, kept } = splitPattern(node.id.properties);
      if (moved.length === 0) {
        return;
      }
      if (moved.length === node.id.properties.length) {
        edits.push(replaceModule(loaded.source));
        return;
      }
      const q = quote(source, loaded.source);
      const load = loaded.awaited ? 'await import' : 'require';
      const statement = (names: string, moduleName: string) =>
        `${declaration.kind} { ${names} } = ${load}(${q}${moduleName}${q})`;
      edits.push(
        replaceStatement(
          source,
          declaration,
          `${finish(source, declaration, statement(namedText(source, kept), ADDON_THEMES))}\n${statement(namedText(source, moved), ADDON_THEMES_REACT)}`
        )
      );
      return;
    }
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      if (
        callee.type !== 'MemberExpression' ||
        callee.computed ||
        callee.property.type !== 'Identifier' ||
        callee.property.name !== 'then' ||
        callee.object.type !== 'ImportExpression'
      ) {
        return;
      }
      const imported = stringLiteral(callee.object.source);
      const callback = node.arguments[0];
      if (!imported || imported.value !== ADDON_THEMES) {
        return;
      }
      if (
        !callback ||
        (callback.type !== 'ArrowFunctionExpression' && callback.type !== 'FunctionExpression')
      ) {
        return;
      }
      const pattern = callback.params[0];
      if (pattern?.type !== 'ObjectPattern') {
        return;
      }
      const { moved } = splitPattern(pattern.properties);
      if (moved.length > 0 && moved.length === pattern.properties.length) {
        edits.push(replaceModule(imported));
      }
      return;
    }
    if (node.type === 'TSImportType') {
      const qualifier = node.qualifier;
      if (
        node.source.value !== ADDON_THEMES ||
        qualifier?.type !== 'Identifier' ||
        !MOVED_NAMES.has(qualifier.name)
      ) {
        return;
      }
      edits.push(replaceModule(node.source));
    }
  });

  if (edits.length === 0) {
    return { code: null, mixedLines: [] };
  }
  const next = applyEdits(source, edits);
  return {
    code: next === source ? null : restoreLineEndings(next, code),
    mixedLines: [],
  };
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
