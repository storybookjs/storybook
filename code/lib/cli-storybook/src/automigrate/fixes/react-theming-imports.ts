import { parser, types as t } from 'storybook/internal/babel';

import picocolors from 'picocolors';

import { getFrameworkPackageName, getRendererName } from '../helpers/mainConfigFile.ts';
import { isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

const THEMING = 'storybook/theming';
const ADDON_THEMES = '@storybook/addon-themes';
const MOVED_FROM_ADDON = ['withThemeFromJSXProvider', 'ProviderStrategyConfiguration'];
const FRAMEWORKS_WITH_THEMING_ENTRY = [
  '@storybook/react-vite',
  '@storybook/react-webpack5',
  '@storybook/nextjs',
  '@storybook/nextjs-vite',
  '@storybook/react-native-web-vite',
  '@storybook/tanstack-react',
];
// Stories that render Storybook's own UI must share its emotion instance, so they keep `storybook/theming`.
const RENDERS_STORYBOOK_UI =
  /['"](?:@storybook\/addon-docs\/blocks|storybook\/internal\/components)['"]/;

export interface ReactThemingImportsResult {
  target: string;
}

type Edit = { start: number; end: number; text: string };

const parse = (code: string) => {
  for (const plugins of [['typescript', 'jsx'], ['typescript']] as const) {
    try {
      return parser.parse(code, { sourceType: 'module', plugins: [...plugins] });
    } catch {}
  }
  return undefined;
};

const importedName = (specifier: t.ImportSpecifier) =>
  t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value;

const quoteOf = (source: t.StringLiteral) => (source.extra?.raw as string | undefined)?.[0] ?? "'";

const printImport = (
  node: t.ImportDeclaration,
  specifiers: string[],
  source: string,
  quote: string
) => {
  const kind = node.importKind === 'type' ? 'import type' : 'import';
  return `${kind} ${specifiers.join(', ')} from ${quote}${source}${quote};`;
};

const splitAddonImport = (code: string, node: t.ImportDeclaration, target: string): Edit[] => {
  const moved = node.specifiers.filter(
    (specifier): specifier is t.ImportSpecifier =>
      t.isImportSpecifier(specifier) && MOVED_FROM_ADDON.includes(importedName(specifier))
  );
  if (moved.length === 0) {
    return [];
  }
  const quote = quoteOf(node.source);
  const text = (specifier: t.Node) => code.slice(specifier.start!, specifier.end!);
  const movedImport = printImport(node, [`{ ${moved.map(text).join(', ')} }`], target, quote);
  if (moved.length === node.specifiers.length) {
    return [
      { start: node.source.start!, end: node.source.end!, text: `${quote}${target}${quote}` },
    ];
  }
  const remaining = node.specifiers.filter(
    (specifier) => !moved.includes(specifier as t.ImportSpecifier)
  );
  const named = remaining.filter((specifier) => t.isImportSpecifier(specifier)).map(text);
  const others = remaining.filter((specifier) => !t.isImportSpecifier(specifier)).map(text);
  const keptImport = printImport(
    node,
    [...others, ...(named.length > 0 ? [`{ ${named.join(', ')} }`] : [])],
    ADDON_THEMES,
    quote
  );
  return [{ start: node.start!, end: node.end!, text: `${keptImport}\n${movedImport}` }];
};

export const rewriteReactThemingImports = (code: string, target: string): string | null => {
  const ast = parse(code);
  if (!ast) {
    return null;
  }
  const keepTheming = RENDERS_STORYBOOK_UI.test(code);
  const edits: Edit[] = [];
  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node)) {
      continue;
    }
    if (node.source.value === THEMING && !keepTheming) {
      const quote = quoteOf(node.source);
      edits.push({
        start: node.source.start!,
        end: node.source.end!,
        text: `${quote}${target}/theming${quote}`,
      });
    }
    if (node.source.value === ADDON_THEMES) {
      edits.push(...splitAddonImport(code, node, target));
    }
  }
  if (edits.length === 0) {
    return null;
  }
  return edits
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, { start, end, text }) => result.slice(0, start) + text + result.slice(end),
      code
    );
};

export const reactThemingImports: Fix<ReactThemingImportsResult> = {
  id: 'react-theming-imports',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-preview-code-storybooktheming-and-withthemefromjsxprovider-moved-to-the-react-renderer',

  async check({ mainConfig, storybookVersion }) {
    if (!isAtOrPastVersion(storybookVersion, '11.0.0') || getRendererName(mainConfig) !== 'react') {
      return null;
    }
    const framework = getFrameworkPackageName(mainConfig);
    return {
      target:
        framework && FRAMEWORKS_WITH_THEMING_ENTRY.includes(framework)
          ? framework
          : '@storybook/react',
    };
  },

  prompt(result) {
    const target = result?.target ?? '@storybook/react';
    return `In preview and story files, import ${picocolors.cyan('withThemeFromJSXProvider')} from ${picocolors.cyan(target)} instead of ${picocolors.cyan(ADDON_THEMES)}, and ${picocolors.cyan(`${target}/theming`)} instead of ${picocolors.cyan(THEMING)}. Manager files keep ${picocolors.cyan(THEMING)}.`;
  },

  transform: ({ result }) => [
    {
      filter: {
        kind: ['preview', 'story'],
        code: /storybook\/theming|withThemeFromJSXProvider|ProviderStrategyConfiguration/,
      },
      handler: (code) => rewriteReactThemingImports(code, result.target),
    },
  ],
};
