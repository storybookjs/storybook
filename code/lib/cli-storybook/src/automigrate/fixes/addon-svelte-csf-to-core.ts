import { relative, resolve } from 'node:path';

import { parser, traverse, types as t } from 'storybook/internal/babel';
import { getProjectRoot, normalizeAddonName, removeAddon } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import { isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import { type FileKind, collectFiles } from '../pipeline.ts';
import type { Fix } from '../types.ts';

const ADDON_SVELTE_CSF = '@storybook/addon-svelte-csf';
const SVELTE_CSF_FRAMEWORKS = ['@storybook/svelte-vite', '@storybook/sveltekit'];
const MIGRATION_GUIDE = 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md';
const LEGACY_SYNTAX_LINK = `${MIGRATION_GUIDE}#svelte-csf-legacy-story-syntax-removed`;

// `from '…'`, `import '…'` and `import('…')`, but not other strings such as an `addons` entry.
// Only for files that don't parse, and MDX.
const ADDON_IMPORT =
  /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"`])@storybook\/addon-svelte-csf\2/g;
// JSDoc type imports, such as `@type {import('…').Args}`.
const COMMENT_IMPORT = /(\bimport\s*\(\s*)(['"`])@storybook\/addon-svelte-csf\2/g;
// Attribute values such as `generics="T extends Record<string, unknown>"` can contain `>`.
const SCRIPT_BLOCK = /(<script\b(?:[^>"']|"[^"]*"|'[^']*')*>)([\s\S]*?)(<\/script>)/g;
const REWRITTEN_KINDS: FileKind[] = ['main', 'preview', 'manager', 'config', 'story'];

export interface AddonSvelteCsfToCoreResult {
  framework: string;
  // Set when the addon is in `addons`, so the main config changes too.
  mainConfigPath?: string;
  importFiles: string[];
  // Stories without `defineMeta`. The fix leaves them for the user to migrate by hand.
  legacyStoryFiles: string[];
  // `defineMeta` stories that still use legacy `<Story>` syntax, with the syntax each one uses.
  legacySyntax: Record<string, string[]>;
}

const isAddonSvelteCsf = (addon: NonNullable<StorybookConfigRaw['addons']>[number]) =>
  normalizeAddonName(addon) === ADDON_SVELTE_CSF;

const needsLegacyWarning = (result: AddonSvelteCsfToCoreResult) =>
  result.legacyStoryFiles.length > 0 || Object.keys(result.legacySyntax).length > 0;

const LEGACY_STORY_ATTRIBUTES = ['let:args', 'let:context', 'id', 'autodocs', 'source'];

// The attribute names of a `<Story …>` tag that starts at `start`. Values in quotes and braces can
// contain `>`, so they are skipped; a shorthand such as `{source}` counts as its name.
const storyTagAttributes = (markup: string, start: number) => {
  const names: string[] = [];
  let name = '';
  let quote = '';
  let depth = 0;
  let expression = '';
  let shorthand = false;
  let afterEquals = false;
  for (let index = start; index < markup.length; index++) {
    const char = markup[index];
    if (quote) {
      quote = char === quote ? '' : quote;
    } else if (depth > 0) {
      depth += char === '{' ? 1 : char === '}' ? -1 : 0;
      if (depth > 0) {
        expression += char;
      } else if (shorthand) {
        names.push(expression.trim());
      }
    } else if (char === '"' || char === "'") {
      quote = char;
      afterEquals = false;
    } else if (char === '{') {
      depth = 1;
      expression = '';
      shorthand = !afterEquals && !name;
      afterEquals = false;
    } else if (char === '=') {
      if (name) {
        names.push(name);
      }
      name = '';
      afterEquals = true;
    } else if (char === '>' || /[\s/]/.test(char)) {
      if (name) {
        names.push(name);
      }
      name = '';
      afterEquals = false;
      if (char === '>') {
        break;
      }
    } else if (!afterEquals) {
      // Anything else after `=` is an unquoted value, which ends at whitespace.
      name += char;
    }
  }
  return names;
};

// Legacy `<Story>` syntax that a `defineMeta` file can still contain.
const legacyStorySyntax = (code: string) => {
  const markup = code
    .replace(SCRIPT_BLOCK, '')
    .replace(/<style\b[\s\S]*?<\/style>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const found = new Set<string>();
  for (const match of markup.matchAll(/<Story(?=[\s/>])/g)) {
    for (const name of storyTagAttributes(markup, match.index + match[0].length)) {
      if (LEGACY_STORY_ATTRIBUTES.includes(name)) {
        found.add(name);
      }
    }
  }
  return LEGACY_STORY_ATTRIBUTES.filter((name) => found.has(name));
};

const parse = (code: string) => {
  // A `.ts` file with `<T>(x: T) => x` or `<T>value` only parses without JSX.
  for (const plugins of [['typescript', 'jsx'], ['typescript']] as const) {
    try {
      return parser.parse(code, { sourceType: 'module', plugins: [...plugins] });
    } catch {}
  }
  return undefined;
};

// Change the module name of the addon's imports, but not other strings or comments that name it.
const renameImports = (code: string, framework: string) => {
  const ast = parse(code);
  if (!ast) {
    return code.replace(ADDON_IMPORT, `$1$2${framework}$2`);
  }
  const ranges: { start: number; end: number }[] = [];
  const addSource = (node: t.Node | null | undefined) => {
    const name = t.isStringLiteral(node)
      ? node.value
      : t.isTemplateLiteral(node) && node.expressions.length === 0
        ? node.quasis[0].value.cooked
        : undefined;
    if (node && name === ADDON_SVELTE_CSF) {
      ranges.push({ start: node.start! + 1, end: node.end! - 1 });
    }
  };
  traverse(ast, {
    ImportDeclaration: ({ node }) => addSource(node.source),
    ExportNamedDeclaration: ({ node }) => addSource(node.source),
    ExportAllDeclaration: ({ node }) => addSource(node.source),
    CallExpression: ({ node }) => {
      if (t.isImport(node.callee)) {
        addSource(node.arguments[0]);
      }
    },
    TSImportType: ({ node }) => {
      const argument = node.argument as t.Node;
      addSource(t.isTSLiteralType(argument) ? argument.literal : argument);
    },
  });
  for (const comment of ast.comments ?? []) {
    for (const match of comment.value.matchAll(COMMENT_IMPORT)) {
      // Comment values start after `//` or `/*`.
      const start = comment.start! + 2 + match.index + match[1].length + 1;
      ranges.push({ start, end: start + ADDON_SVELTE_CSF.length });
    }
  }
  return ranges
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, { start, end }) => result.slice(0, start) + framework + result.slice(end),
      code
    );
};

// Without this, a file that already imports from the framework package ends up with two imports.
const mergeImports = (code: string, source: string) => {
  const ast = parse(code);
  if (!ast) {
    return code;
  }

  const groups = new Map<string, t.ImportDeclaration[]>();
  for (const node of ast.program.body) {
    if (
      t.isImportDeclaration(node) &&
      node.source.value === source &&
      node.specifiers.length > 0 &&
      node.specifiers.every((specifier) => t.isImportSpecifier(specifier))
    ) {
      const kind = node.importKind ?? 'value';
      groups.set(kind, [...(groups.get(kind) ?? []), node]);
    }
  }

  const edits: { start: number; end: number; text: string }[] = [];
  for (const [first, ...rest] of groups.values()) {
    if (rest.length === 0) {
      continue;
    }
    const specifiers = [first, ...rest].flatMap(({ specifiers }) =>
      specifiers.map((specifier) => code.slice(specifier.start!, specifier.end!))
    );
    edits.push({
      start: first.specifiers[0].start!,
      end: first.specifiers.at(-1)!.end!,
      text: [...new Set(specifiers)].join(', '),
    });
    for (const node of rest) {
      const lineStart = code.lastIndexOf('\n', node.start! - 1) + 1;
      const lineEnd = code.startsWith('\r\n', node.end!) ? 2 : code[node.end!] === '\n' ? 1 : 0;
      const ownLine = code.slice(lineStart, node.start!).trim() === '' && lineEnd > 0;
      edits.push(
        ownLine
          ? { start: lineStart, end: node.end! + lineEnd, text: '' }
          : { start: node.start!, end: node.end!, text: '' }
      );
    }
  }

  return edits
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, { start, end, text }) => result.slice(0, start) + text + result.slice(end),
      code
    );
};

const rewriteScript = (code: string, framework: string) => {
  const renamed = renameImports(code, framework);
  return renamed === code ? code : mergeImports(renamed, framework);
};

// Resolves with `null` when the file does not import the addon.
const rewriteImports = (code: string, path: string, framework: string) => {
  const rewritten = path.endsWith('.svelte')
    ? code.replace(
        SCRIPT_BLOCK,
        (_, open: string, content: string, close: string) =>
          open + rewriteScript(content, framework) + close
      )
    : // MDX is not JavaScript, so its imports are only renamed.
      path.endsWith('.mdx')
      ? code.replace(ADDON_IMPORT, `$1$2${framework}$2`)
      : rewriteScript(code, framework);
  return rewritten === code ? null : rewritten;
};

// `defineMeta` as code in a `<script>` block, not in a comment, a string or the markup.
const usesDefineMeta = (code: string) =>
  [...code.matchAll(SCRIPT_BLOCK)].some(([, , content]) => {
    const ast = parse(content);
    if (!ast) {
      return /\bdefineMeta\b/.test(content);
    }
    let found = false;
    traverse(ast, {
      Identifier: (path) => {
        if (path.node.name === 'defineMeta') {
          found = true;
          path.stop();
        }
      },
    });
    return found;
  });

const fileList = (paths: string[], notes: Record<string, string> = {}) =>
  paths
    .map((path) => `- ${relative(getProjectRoot(), path)}${notes[path] ? ` (${notes[path]})` : ''}`)
    .join('\n');

const legacyWarning = ({ legacyStoryFiles, legacySyntax }: AddonSvelteCsfToCoreResult) => {
  const notes: Record<string, string> = Object.fromEntries([
    ...legacyStoryFiles.map((path) => [path, 'no defineMeta']),
    ...Object.entries(legacySyntax).map(([path, syntax]) => [path, syntax.join(', ')]),
  ]);
  return dedent`
    Storybook 11 removes the legacy Svelte CSF syntax, such as ${picocolors.cyan('<Meta>')}, ${picocolors.cyan('<Template>')}, ${picocolors.cyan('let:args')} and the ${picocolors.cyan('id')}, ${picocolors.cyan('autodocs')} and ${picocolors.cyan('source')} props on ${picocolors.cyan('<Story>')}. Migrate these stories by hand:
    ${fileList(Object.keys(notes), notes)}

    See ${LEGACY_SYNTAX_LINK}
  `;
};

export const addonSvelteCsfToCore: Fix<AddonSvelteCsfToCoreResult> = {
  id: 'addon-svelte-csf-to-core',
  link: `${MIGRATION_GUIDE}#svelte-csf-is-built-into-the-svelte-frameworks`,

  async check({
    mainConfig,
    mainConfigPath,
    previewConfigPath,
    packageManager,
    storybookVersion,
    configDir,
    storiesPaths,
    files,
  }) {
    const framework = getFrameworkPackageName(mainConfig);
    const addonEntry = mainConfig.addons?.find(isAddonSvelteCsf);

    if (
      !isAtOrPastVersion(storybookVersion, '11.0.0') ||
      !framework ||
      !SVELTE_CSF_FRAMEWORKS.includes(framework) ||
      (!addonEntry && !packageManager.getAllDependencies()[ADDON_SVELTE_CSF])
    ) {
      return null;
    }

    const projectFiles = configDir
      ? await collectFiles(
          { configDir, mainConfigPath, previewConfigPath, storiesPaths },
          new Set(REWRITTEN_KINDS)
        )
      : storiesPaths.map((id) => ({ id, kind: 'story' as const }));
    const importFiles: string[] = [];
    const legacyStoryFiles: string[] = [];
    const legacySyntax: Record<string, string[]> = {};
    for (const { id, kind } of projectFiles) {
      const code = await files.read(id);
      if (rewriteImports(code, id, framework) === null) {
        continue;
      }
      const path = resolve(id);
      const isSvelteStory = kind === 'story' && id.endsWith('.svelte');
      if (isSvelteStory && !usesDefineMeta(code)) {
        legacyStoryFiles.push(path);
        continue;
      }
      importFiles.push(path);
      const syntax = isSvelteStory ? legacyStorySyntax(code) : [];
      if (syntax.length > 0) {
        legacySyntax[path] = syntax;
      }
    }

    return {
      framework,
      mainConfigPath: addonEntry ? mainConfigPath : undefined,
      importFiles,
      legacyStoryFiles,
      legacySyntax,
    };
  },

  prompt(result) {
    const summary = `Migrate from ${picocolors.magenta(ADDON_SVELTE_CSF)} to the Svelte CSF built into your framework`;
    if (!result) {
      return summary;
    }
    const changedFiles = [
      ...new Set([
        ...(result.mainConfigPath ? [resolve(result.mainConfigPath)] : []),
        ...result.importFiles,
      ]),
    ];
    const changes =
      changedFiles.length > 0
        ? `\n\nFiles that change, besides package.json:\n${fileList(changedFiles)}\n\nChange other files that import the addon by hand.`
        : '';
    const legacy = needsLegacyWarning(result) ? `\n\n${legacyWarning(result)}` : '';
    return summary + changes + legacy;
  },

  transform: ({ result }) => {
    const legacyStoryFiles = new Set(result.legacyStoryFiles);
    return [
      {
        filter: { kind: REWRITTEN_KINDS, code: ADDON_SVELTE_CSF },
        handler: (code, { id }) =>
          legacyStoryFiles.has(resolve(id)) ? null : rewriteImports(code, id, result.framework),
      },
    ];
  },

  async run({ packageManager, result, configDir, storybookVersion }) {
    // In a monorepo, the packages that own stories also list the addon, and import from it.
    packageManager.replaceDependency(ADDON_SVELTE_CSF, result.framework, `^${storybookVersion}`);
    await removeAddon(ADDON_SVELTE_CSF, { packageManager, configDir, skipInstall: true });
  },
};
