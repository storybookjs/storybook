import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { parser, traverse, types as t } from 'storybook/internal/babel';

import type { FileInfo } from '../../automigrate/codemod.ts';
import {
  type PreviewImportOptions,
  getPreviewImportPath,
  reuseDisallowList,
} from './csf-factories-utils.ts';

const SVELTE_CSF_IMPORT_SOURCES = [
  '@storybook/svelte',
  '@storybook/svelte-vite',
  '@storybook/sveltekit',
];
// Attribute values such as `generics="T extends Record<string, unknown>"` can contain `>`.
const SCRIPT_BLOCK = /(<script\b(?:[^>"']|"[^"]*"|'[^']*')*>)([\s\S]*?)(<\/script>)/g;
// `<script module>`, or `<script context="module">` from Svelte 4
const MODULE_SCRIPT_TAG = /\smodule[\s>=]|\scontext=["']module["']/;
const STORIES_FILE = /\.stories(\.(svelte|ts|tsx|js|jsx|mjs|mts))?$/;

interface Edit {
  start: number;
  end: number;
  text: string;
}

interface StoryImports {
  // `X` in `import * as X from './Button.stories.svelte'`, for `X.Primary.args`. `X.data` is not a
  // story when the imported file exports `data`.
  namespaces: { name: string; nonStories: string[] }[];
  // `Primary` in `import { Primary } from './Button.stories.svelte'`, for `Primary.args`
  stories: string[];
}

// Only the meta changes: the `Story` components of `preview.meta()` take the same props
export function svelteCsfToCsfFactory(info: FileInfo, options: PreviewImportOptions): string {
  const storyImports: StoryImports = { namespaces: [], stories: [] };
  let migrated = false;
  const source = info.source.replace(
    SCRIPT_BLOCK,
    (block, open: string, content: string, close: string) => {
      const result = MODULE_SCRIPT_TAG.test(open)
        ? transformModuleScript(content, info.path, getPreviewImportPath(info.path, options))
        : undefined;
      if (!result) {
        return block;
      }
      migrated = true;
      storyImports.namespaces.push(...result.storyImports.namespaces);
      storyImports.stories.push(...result.storyImports.stories);
      return open + result.code + close;
    }
  );
  return migrated ? readStoryInputs(source, storyImports) : source;
}

/**
 * The named exports of the module script of a Svelte CSF file, such as `export const data = {…}`.
 * They are never stories: Svelte CSF declares its stories with `<Story>` components.
 */
export function findSvelteCsfNonStoryExports(importer: string, source: string): string[] {
  if (!source.endsWith('.svelte')) {
    return [];
  }
  let code;
  try {
    code = readFileSync(resolve(dirname(importer), source), 'utf-8');
  } catch {
    return [];
  }
  return [...code.matchAll(SCRIPT_BLOCK)].flatMap(([, open, content]) => {
    if (!MODULE_SCRIPT_TAG.test(open)) {
      return [];
    }
    try {
      const { body } = parser.parse(content, {
        sourceType: 'module',
        plugins: ['typescript'],
      }).program;
      return body.flatMap((node) => {
        if (!t.isExportNamedDeclaration(node)) {
          return [];
        }
        const names = node.specifiers.map((specifier) =>
          t.isIdentifier(specifier.exported) ? specifier.exported.name : specifier.exported.value
        );
        const declared = node.declaration ? t.getBindingIdentifiers(node.declaration) : {};
        return [...names, ...Object.keys(declared)];
      });
    } catch {
      return [];
    }
  });
}

// The codemod also migrates the imported stories files, which then keep the annotations of a story
// in `input`: `Primary.args` becomes `Primary.input.args`, in the scripts and in the markup.
function readStoryInputs(source: string, { namespaces, stories }: StoryImports) {
  const notOneOf = (names: string[]) => (names.length ? `(?!(?:${names.join('|')})\\b)` : '');
  const property = `${notOneOf([...reuseDisallowList, 'input', 'composed'])}[\\w$]+`;
  // Not `other.Primary`, but a spread such as `...Primary` is fine
  const story = (name: string) => `(?<![\\w$])(?<![^.]\\.)${name.replaceAll('$', '\\$')}`;
  return [
    ...namespaces.map(
      ({ name, nonStories }) =>
        new RegExp(`(${story(name)}\\.${notOneOf(nonStories)}[\\w$]+)\\.(${property})`, 'g')
    ),
    ...stories.map((name) => new RegExp(`(${story(name)})\\.(${property})`, 'g')),
  ].reduce((result, pattern) => result.replace(pattern, '$1.input.$2'), source);
}

const importedName = (specifier: t.ImportSpecifier) =>
  t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value;

const isDefineMetaSpecifier = (
  specifier: t.ImportDeclaration['specifiers'][number]
): specifier is t.ImportSpecifier =>
  t.isImportSpecifier(specifier) &&
  specifier.importKind !== 'type' &&
  t.isIdentifier(specifier.imported, { name: 'defineMeta' });

function transformModuleScript(
  code: string,
  filePath: string,
  previewPath: string
): { code: string; storyImports: StoryImports } | undefined {
  let ast;
  try {
    ast = parser.parse(code, { sourceType: 'module', plugins: ['typescript'] });
  } catch {
    return undefined;
  }

  const svelteCsfImport = ast.program.body.find(
    (node): node is t.ImportDeclaration =>
      t.isImportDeclaration(node) &&
      SVELTE_CSF_IMPORT_SOURCES.includes(node.source.value) &&
      node.specifiers.some(isDefineMetaSpecifier)
  );
  const defineMetaSpecifier = svelteCsfImport?.specifiers.find(isDefineMetaSpecifier);
  if (!svelteCsfImport || !defineMetaSpecifier) {
    return undefined;
  }

  let previewName = 'preview';
  const edits: Edit[] = [];
  traverse(ast, {
    Program(path) {
      if (path.scope.hasBinding(previewName)) {
        previewName = 'storybookPreview';
      }
    },
    CallExpression({ node }) {
      if (t.isIdentifier(node.callee, { name: defineMetaSpecifier.local.name })) {
        edits.push({
          start: node.callee.start!,
          end: node.callee.end!,
          text: `${previewName}.meta`,
        });
      }
    },
  });
  if (edits.length === 0) {
    return undefined;
  }

  const { start, end, source, specifiers } = svelteCsfImport;
  const quote = code[source.start!];
  const semicolon = code[end! - 1] === ';' ? ';' : '';
  const previewImport = `import ${previewName} from ${quote}${previewPath}${quote}${semicolon}`;
  const otherSpecifiers = specifiers.filter((specifier) => specifier !== defineMetaSpecifier);

  if (otherSpecifiers.length === 0) {
    edits.push({ start: start!, end: end!, text: previewImport });
  } else {
    const indentation = code.slice(code.lastIndexOf('\n', start! - 1) + 1, start!);
    edits.push(
      {
        start: specifiers[0].start!,
        end: specifiers.at(-1)!.end!,
        text: otherSpecifiers
          .map((specifier) => code.slice(specifier.start!, specifier.end!))
          .join(', '),
      },
      { start: end!, end: end!, text: `\n${indentation}${previewImport}` }
    );
  }

  const storyImports: StoryImports = { namespaces: [], stories: [] };
  for (const node of ast.program.body) {
    if (t.isImportDeclaration(node) && STORIES_FILE.test(node.source.value)) {
      const nonStories = findSvelteCsfNonStoryExports(filePath, node.source.value);
      for (const specifier of node.specifiers) {
        if (!t.isImportSpecifier(specifier)) {
          storyImports.namespaces.push({ name: specifier.local.name, nonStories });
        } else if (!nonStories.includes(importedName(specifier))) {
          storyImports.stories.push(specifier.local.name);
        }
      }
    }
  }

  return {
    code: edits
      .sort((a, b) => b.start - a.start)
      .reduce(
        (result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end),
        code
      ),
    storyImports,
  };
}
