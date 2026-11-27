import { readFileSync } from 'node:fs';

import { type ESTree as E, SourceEditor, walk } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import { dirname, resolve } from 'pathe';

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
  if (!source.startsWith('.')) {
    logger.warn(
      `Can't read ${source}, imported by ${importer}: the codemod doesn't follow builder aliases. It treats every export of that file as a story. Check the references to exports that aren't stories, such as data.`
    );
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
      return new SourceEditor(content, source).program.body.flatMap((node) => {
        if (node.type !== 'ExportNamedDeclaration') {
          return [];
        }
        const names = node.specifiers.map(({ exported }) =>
          exported.type === 'Identifier' ? exported.name : String(exported.value)
        );
        const { declaration } = node;
        if (declaration?.type === 'VariableDeclaration') {
          names.push(
            ...declaration.declarations.flatMap(({ id }) =>
              id.type === 'Identifier' ? id.name : []
            )
          );
        } else if (declaration && 'id' in declaration && declaration.id?.type === 'Identifier') {
          names.push(declaration.id.name);
        }
        return names;
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

const importedName = (specifier: E.ImportSpecifier) =>
  specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value;

const isDefineMetaSpecifier = (
  specifier: E.ImportDeclaration['specifiers'][number]
): specifier is E.ImportSpecifier =>
  specifier.type === 'ImportSpecifier' &&
  specifier.importKind !== 'type' &&
  importedName(specifier) === 'defineMeta';

function transformModuleScript(
  content: string,
  filePath: string,
  previewPath: string
): { code: string; storyImports: StoryImports } | undefined {
  let editor;
  try {
    editor = new SourceEditor(content, filePath);
  } catch {
    return undefined;
  }
  const { code, program } = editor;

  const svelteCsfImport = program.body.find(
    (node): node is E.ImportDeclaration =>
      node.type === 'ImportDeclaration' &&
      SVELTE_CSF_IMPORT_SOURCES.includes(node.source.value) &&
      node.specifiers.some(isDefineMetaSpecifier)
  );
  const defineMetaSpecifier = svelteCsfImport?.specifiers.find(isDefineMetaSpecifier);
  if (!svelteCsfImport || !defineMetaSpecifier) {
    return undefined;
  }

  const previewName = editor.scopes.program.bindings.has('preview')
    ? 'storybookPreview'
    : 'preview';
  let migrated = false;
  walk(program, (node) => {
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === defineMetaSpecifier.local.name
    ) {
      editor.edits.overwrite(node.callee.start, node.callee.end, `${previewName}.meta`);
      migrated = true;
    }
  });
  if (!migrated) {
    return undefined;
  }

  const { start, end, source, specifiers } = svelteCsfImport;
  const quote = code[source.start];
  const semicolon = code[end - 1] === ';' ? ';' : '';
  const previewImport = `import ${previewName} from ${quote}${previewPath}${quote}${semicolon}`;
  const otherSpecifiers = specifiers.filter((specifier) => specifier !== defineMetaSpecifier);

  if (otherSpecifiers.length === 0) {
    editor.edits.overwrite(start, end, previewImport);
  } else {
    const indentation = code.slice(code.lastIndexOf('\n', start - 1) + 1, start);
    editor.edits
      .overwrite(
        specifiers[0].start,
        specifiers.at(-1)!.end,
        otherSpecifiers.map((specifier) => code.slice(specifier.start, specifier.end)).join(', ')
      )
      .appendLeft(end, `\n${indentation}${previewImport}`);
  }

  const storyImports: StoryImports = { namespaces: [], stories: [] };
  for (const node of program.body) {
    if (node.type === 'ImportDeclaration' && STORIES_FILE.test(node.source.value)) {
      const nonStories = findSvelteCsfNonStoryExports(filePath, node.source.value);
      for (const specifier of node.specifiers) {
        if (specifier.type !== 'ImportSpecifier') {
          storyImports.namespaces.push({ name: specifier.local.name, nonStories });
        } else if (!nonStories.includes(importedName(specifier))) {
          storyImports.stories.push(specifier.local.name);
        }
      }
    }
  }

  return { code: editor.toString(), storyImports };
}
