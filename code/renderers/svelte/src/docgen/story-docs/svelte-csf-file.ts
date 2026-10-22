import { type ESTree, SourceEditor, generateUid } from 'storybook/internal/csf-tools';

import { getSvelteAST } from '../../svelte-csf/parser/ast.ts';
import { getStoriesIdentifiers } from '../../svelte-csf/parser/analyse/story/attributes/identifiers.ts';
import { getStoryContentRawCode } from '../../svelte-csf/parser/analyse/story/content.ts';
import { getDefineMetaFirstArgumentObjectExpression } from '../../svelte-csf/parser/extract/svelte/define-meta.ts';
import { extractSvelteASTNodes } from '../../svelte-csf/parser/extract/svelte/nodes.ts';
import {
  findMetaRenderSnippetBlock,
  findStoryAttributeTemplateSnippetBlock,
} from '../../svelte-csf/parser/extract/svelte/snippet-block.ts';
import { extractStoryAttributesNodes } from '../../svelte-csf/parser/extract/svelte/story/attributes.ts';
import { extractStoryTemplateSnippetBlock } from '../../svelte-csf/parser/extract/svelte/story/template.ts';
import type { ESTreeAST, SvelteAST } from '../../svelte-csf/parser/ast.ts';
import { type Edit, applyEdits, scriptFile, span } from './markup.ts';
import type { TemplateParameter } from './print-template.ts';

export interface StoryMarkup {
  template?: string;
  // How the template snippet receives the args, when the story has one.
  parameter?: TemplateParameter;
  description?: string;
}

export interface StoryFile {
  // The story file as plain CSF, so the shared csf-tools can read its meta and args.
  csfSource: string;
  typescript: boolean;
  // Markup of each Svelte CSF story, by export name.
  stories: Map<string, StoryMarkup>;
  // Snippets declared at the top of a Svelte CSF file, which args can pass by name.
  snippets: Map<string, { parameters: string; body: string }>;
  moduleScript?: string;
  instanceScript?: string;
}

// Read a `.stories.svelte` file as plain CSF: the module script with the meta as default export,
// and one story export with the `args` of each `<Story>`.
export async function readSvelteCsfFile(source: string, filename: string): Promise<StoryFile> {
  const ast = getSvelteAST({ code: source, filename });
  const typescript = isTypeScript(ast.module) || isTypeScript(ast.instance);
  const nodes = await extractSvelteASTNodes({ ast, filename });
  const module = span(ast.module!.content);
  const moduleScript = source.slice(module.start, module.end);
  const instanceScript = ast.instance
    ? source.slice(span(ast.instance.content).start, span(ast.instance.content).end)
    : undefined;

  const declaration = span(nodes.defineMetaVariableDeclaration);
  const meta = span(getDefineMetaFirstArgumentObjectExpression({ nodes, filename }));
  const moduleEditor = new SourceEditor(moduleScript, scriptFile(typescript));
  const { scopes } = moduleEditor;
  let csfSource = applyEdits(moduleScript, [
    ...unexported(moduleEditor.program),
    {
      start: declaration.start - module.start,
      end: declaration.end - module.start,
      value: `export default ${source.slice(meta.start, meta.end)};`,
    },
  ]);

  const stories = new Map<string, StoryMarkup>();
  const identifiers = getStoriesIdentifiers({ nodes, filename });
  for (const [index, story] of nodes.storyComponents.entries()) {
    const { exportName, name } = identifiers[index];
    const value = extractStoryAttributesNodes({ component: story.component, attributes: ['args'] })
      .args?.value;
    const chunk = Array.isArray(value) ? value[0] : value;
    const args =
      chunk && chunk !== true && chunk.type === 'ExpressionTag'
        ? source.slice(span(chunk.expression).start, span(chunk.expression).end)
        : '{}';
    const storyObject = `{ name: ${JSON.stringify(name)}, args: ${args} }`;
    // Svelte CSF exports a story under a name of its own, so the module script may declare it too.
    if (scopes.names.has(exportName)) {
      const local = generateUid(scopes, exportName);
      csfSource += `\nconst ${local} = ${storyObject};\nexport { ${local} as ${exportName} };`;
    } else {
      csfSource += `\nexport const ${exportName} = ${storyObject};`;
    }
    const template = getStoryContentRawCode({
      nodes: { component: story.component, svelte: nodes },
      originalCode: source,
      filename,
    });
    const parameter = templateParameter(story.component, nodes, filename);
    stories.set(exportName, {
      // Without a meta component, a story with no markup of its own renders nothing static.
      template: template.startsWith('<undefined ') ? undefined : template,
      ...(parameter ? { parameter } : {}),
      description: story.comment?.data.trim(),
    });
  }

  const snippets = new Map<string, { parameters: string; body: string }>();
  for (const snippet of nodes.snippetBlocks) {
    const first = snippet.body.nodes[0];
    const last = snippet.body.nodes.at(-1);
    const parameters = snippet.parameters.map((parameter) =>
      source.slice(span(parameter).start, span(parameter).end)
    );
    snippets.set(snippet.expression.name, {
      parameters: parameters.join(', '),
      body: first && last ? source.slice(first.start, last.end).trim() : '',
    });
  }

  return {
    csfSource,
    typescript,
    stories,
    snippets,
    moduleScript,
    instanceScript,
  };
}

// The first parameter of the snippet that renders a story, as `getStoryContentRawCode` picks it.
function templateParameter(
  component: SvelteAST.Component,
  nodes: Awaited<ReturnType<typeof extractSvelteASTNodes>>,
  filename: string
): TemplateParameter | undefined {
  const block =
    component.fragment.nodes.length === 0
      ? (findStoryAttributeTemplateSnippetBlock({ component, nodes, filename }) ??
        findMetaRenderSnippetBlock({ nodes, filename }))
      : extractStoryTemplateSnippetBlock(component);
  const pattern = block?.parameters[0] as ESTreeAST.Pattern | undefined;
  if (pattern?.type === 'Identifier') return { name: pattern.name, aliases: {} };
  if (pattern?.type !== 'ObjectPattern') return undefined;
  const parameter: TemplateParameter = { aliases: {} };
  for (const property of pattern.properties) {
    if (property.type === 'RestElement') {
      if (property.argument.type === 'Identifier') parameter.name = property.argument.name;
      continue;
    }
    const key =
      property.key.type === 'Identifier' && !property.computed
        ? property.key.name
        : property.key.type === 'Literal'
          ? String(property.key.value)
          : undefined;
    const value =
      property.value.type === 'AssignmentPattern' ? property.value.left : property.value;
    if (key !== undefined && value.type === 'Identifier') parameter.aliases[value.name] = key;
  }
  return parameter;
}

// Only the stories are exports of the CSF source, so the exports of the module script become plain
// declarations.
function unexported(program: ESTree.Program): Edit[] {
  return program.body.flatMap((statement): Edit[] => {
    if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
      return [{ start: statement.start, end: statement.declaration.start, value: '' }];
    }
    return statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportAllDeclaration'
      ? [{ start: statement.start, end: statement.end, value: '' }]
      : [];
  });
}

function isTypeScript(script: ReturnType<typeof getSvelteAST>['module']): boolean {
  return (
    script?.attributes.some(
      (attribute) =>
        attribute.name === 'lang' &&
        Array.isArray(attribute.value) &&
        attribute.value.some((value) => value.type === 'Text' && value.data === 'ts')
    ) ?? false
  );
}
