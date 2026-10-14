import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { sanitize } from 'storybook/internal/csf';
import type {
  StoryDoc,
  StoryDocsById,
  StoryDocsPayload,
  StoryDocsProviderInput,
} from 'storybook/internal/types';

import { getSvelteAST, type ESTreeAST, type SvelteAST } from '../../svelte-csf/parser/ast.ts';
import { getStoryContentRawCode } from '../../svelte-csf/parser/analyse/story/content.ts';
import { getStoryIdentifiers } from '../../svelte-csf/parser/analyse/story/attributes/identifiers.ts';
import { extractSvelteASTNodes } from '../../svelte-csf/parser/extract/svelte/nodes.ts';
import { extractStoryAttributesNodes } from '../../svelte-csf/parser/extract/svelte/story/attributes.ts';
import { generateCodeToEmit } from '../../svelte-csf/runtime/emit-code.ts';
import { SVELTE_STORY_FILE_TEST_REGEXP } from '../story-file.ts';

export interface SvelteCsfStoryDoc {
  exportName: string;
  name: string;
  /** The `<Story>` content as authored, `args` references kept; same as `__svelteCsf.rawCode`. */
  template: string;
  /** Args written as literals on `<Story args={{ ... }}>`; `{}` when not statically known. */
  args: Record<string, unknown>;
}

/** Parses a `.stories.svelte` file and returns each story's raw template, like the vite plugin. */
export async function buildSvelteCsfStoryDocs(
  source: string,
  filename?: string
): Promise<SvelteCsfStoryDoc[]> {
  const ast = getSvelteAST({ code: source, filename });
  const nodes = await extractSvelteASTNodes({ ast, filename });

  return nodes.storyComponents.map(({ component }) => {
    const attrs = extractStoryAttributesNodes({
      component,
      filename,
      attributes: ['name', 'exportName', 'args'],
    });
    const { exportName, name } = getStoryIdentifiers({
      component,
      filename,
      nameNode: attrs.name,
      exportNameNode: attrs.exportName,
    });
    const template = getStoryContentRawCode({
      nodes: { component, svelte: nodes },
      originalCode: source,
      filename,
    });
    return { exportName, name: name ?? exportName, template, args: staticArgs(attrs.args) };
  });
}

// TODO: also read `args` from `defineMeta`, and resolve identifiers, as the CSF providers do.
function staticArgs(node: SvelteAST.Attribute | undefined): Record<string, unknown> {
  const value = node?.value;
  if (!value || value === true || Array.isArray(value)) {
    return {};
  }
  const result = literalValue(value.expression as ESTreeAST.Expression);
  return result && typeof result === 'object' && !Array.isArray(result)
    ? (result as Record<string, unknown>)
    : {};
}

function literalValue(node: ESTreeAST.Node): unknown {
  switch (node.type) {
    case 'Literal':
      return node.value;
    case 'ArrayExpression':
      return node.elements.map((element) => (element ? literalValue(element) : undefined));
    case 'ObjectExpression': {
      const object: Record<string, unknown> = {};
      for (const property of node.properties) {
        if (property.type !== 'Property' || property.computed) {
          continue;
        }
        const key =
          property.key.type === 'Identifier'
            ? property.key.name
            : property.key.type === 'Literal'
              ? String(property.key.value)
              : undefined;
        const value = literalValue(property.value);
        if (key !== undefined && value !== undefined) {
          object[key] = value;
        }
      }
      return object;
    }
    default:
      return undefined;
  }
}

export async function buildStoryDocsPayload(
  input: StoryDocsProviderInput
): Promise<StoryDocsPayload | undefined> {
  const storyFilePath = getStoryImportPathFromEntry(input.entry);
  if (!storyFilePath || !SVELTE_STORY_FILE_TEST_REGEXP.test(storyFilePath)) {
    return undefined;
  }
  const absolutePath = isAbsolute(storyFilePath)
    ? storyFilePath
    : join(process.cwd(), storyFilePath);

  let parsed: SvelteCsfStoryDoc[];
  try {
    parsed = await buildSvelteCsfStoryDocs(await readFile(absolutePath, 'utf8'), absolutePath);
  } catch {
    return undefined;
  }

  const id = getComponentIdFromEntry(input.entry);
  const stories: StoryDocsById = {};
  for (const story of parsed) {
    const storyId = `${id}--${sanitize(story.exportName)}`;
    const doc: StoryDoc = {
      id: storyId,
      name: story.name,
      template: story.template,
      templateSyntax: 'svelte',
      snippet: generateCodeToEmit({ code: story.template, args: story.args }),
    };
    stories[storyId] = doc;
  }

  return {
    id,
    name: input.entry.title.split('/').at(-1)!.replace(/\s+/g, ''),
    path: storyFilePath,
    stories,
  };
}
