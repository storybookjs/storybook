import { parser, traverse, types as t } from 'storybook/internal/babel';

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

type Edit = { start: number; end: number; text: string };

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

const exportMoves = (specifier: t.ExportSpecifier) => MOVED_NAMES.has(bindingName(specifier.local));

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
  specifiers: t.ExportSpecifier[],
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

const rewriteJsxProviderImports = (code: string): string | null => {
  const ast = parse(code);
  if (!ast) {
    return null;
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
        !t.isObjectPattern(path.node.id) ||
        !t.isCallExpression(path.node.init) ||
        !t.isIdentifier(path.node.init.callee, { name: 'require' })
      ) {
        return;
      }
      const source = literalArgument(path.node.init.arguments[0]);
      if (!source || source.value !== ADDON_THEMES) {
        return;
      }
      const properties = path.node.id.properties;
      const moved = properties.filter(
        (property) => t.isObjectProperty(property) && MOVED_NAMES.has(propertyName(property) ?? '')
      );
      if (moved.length === 0) {
        return;
      }
      if (moved.length === properties.length) {
        edits.push(replaceModule(source));
        return;
      }
      const kept = properties.filter((property) => !moved.includes(property));
      const q = quote(code, source);
      const kind = declaration.kind;
      const requireOf = (names: string, moduleName: string) =>
        `${kind} { ${names} } = require(${q}${moduleName}${q})`;
      edits.push(
        replaceStatement(
          code,
          declaration,
          `${finish(code, declaration, requireOf(namedText(code, kept), ADDON_THEMES))}\n${requireOf(namedText(code, moved), ADDON_THEMES_REACT)}`
        )
      );
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
    return null;
  }
  const next = applyEdits(code, edits);
  return next === code ? null : next;
};

export const addonThemesJsxProvider: Fix = {
  id: 'addon-themes-jsx-provider',
  link: MIGRATION_LINK,

  prompt: () =>
    `Move ${picocolors.cyan('withThemeFromJSXProvider')} imports to ${picocolors.cyan(ADDON_THEMES_REACT)}`,

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
    for (const { id } of projectFiles) {
      if (rewriteJsxProviderImports(await files.read(id))) {
        return {};
      }
    }
    return null;
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
