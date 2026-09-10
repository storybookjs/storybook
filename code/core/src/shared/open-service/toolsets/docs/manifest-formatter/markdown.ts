/**
 * Markdown rendering for the docs toolset: the text every consumer of the docs tools receives.
 */
import { dedent } from 'ts-dedent';

import { formatRequiresOwnMcpNotice, type SourceListing } from '../sources.ts';

import { extractDocsSummary, MAX_SUMMARY_LENGTH } from './extract-docs-summary.ts';
import type {
  AllManifests,
  ComponentManifest,
  ComponentManifestEntry,
  Doc,
  DocEntry,
  Story,
  SubcomponentManifest,
} from './manifest-types.ts';
import {
  parseReactComponentMeta,
  parseReactDocgen,
  parseReactDocgenTypescript,
  type ParsedDocgen,
} from './parse-react-docgen.ts';

/**
 * Maximum number of stories to show in full detail in component manifests.
 * Remaining stories will be shown as names only.
 */
export const MAX_STORIES_TO_SHOW = 3;

const TOP_JSDOC_TAG_NAMES = new Set(['deprecated']);
const EXAMPLE_JSDOC_TAG_NAME = 'example';

const HIDDEN_JSDOC_TAG_NAMES = new Set([
  // Asks for the component to be hidden, so echoing it back is the opposite of the intent.
  'ignore',
  // Consumed by `extractComponentDescription` as the description, which is rendered on its own.
  'desc',
  'description',
  // Storybook's own description override, consumed alongside `desc`.
  'describe',
  // Consumed into the `summary` field, which the component listing already prints.
  'summary',
  // Consumed into the import statement printed above every story snippet.
  'import',
]);

type ListFormattingOptions = {
  withStoryIds?: boolean;
};

type JsDocTags = Record<string, string[]>;

function formatComponentLine(component: ComponentManifestEntry): string {
  const summary =
    component.summary ??
    (component.description
      ? component.description.length > MAX_SUMMARY_LENGTH
        ? `${component.description.slice(0, MAX_SUMMARY_LENGTH)}...`
        : component.description
      : undefined);

  if (summary) {
    return `- ${component.name} (${component.id}): ${summary}`;
  }
  return `- ${component.name} (${component.id})`;
}

function formatDocLine(doc: DocEntry): string {
  // `title`/`content` only exist on inline (v0) docs; v1 index rows carry just a summary.
  const title = 'title' in doc ? doc.title : undefined;
  const content = 'content' in doc ? doc.content : undefined;
  const summary = doc.summary ?? extractDocsSummary(content ?? '');
  return `- ${title ?? doc.name} (${doc.id})${summary ? `: ${summary}` : ''}`;
}

function formatStorySubLine(story: Story): string {
  return `  - ${story.name}` + (story.id ? ` (${story.id})` : '');
}

/**
 * Extracts a summary from an object with optional summary and description fields.
 * Prefers summary if available, otherwise truncates description to maxLength.
 */
function extractSummary(
  item: { summary?: string; description?: string },
  maxLength: number = MAX_SUMMARY_LENGTH
): string | undefined {
  if (item.summary) {
    return item.summary;
  }
  if (item.description) {
    return item.description.length > maxLength
      ? `${item.description.slice(0, maxLength)}...`
      : item.description;
  }
  return undefined;
}

/**
 * Extract parsed docgen from a component manifest, preferring reactDocgen over
 * reactDocgenTypescript over reactComponentMeta.
 */
function getParsedDocgen(
  componentManifest: Pick<
    ComponentManifest | SubcomponentManifest,
    'reactDocgen' | 'reactDocgenTypescript' | 'reactComponentMeta'
  >
): ParsedDocgen | undefined {
  if (componentManifest.reactDocgen) {
    return parseReactDocgen(componentManifest.reactDocgen);
  }
  if (componentManifest.reactDocgenTypescript) {
    return parseReactDocgenTypescript(componentManifest.reactDocgenTypescript);
  }
  if (componentManifest.reactComponentMeta) {
    return parseReactComponentMeta(componentManifest.reactComponentMeta);
  }
  return undefined;
}

function getNonEmptyJsDocTags(jsDocTags: JsDocTags | undefined): JsDocTags | undefined {
  return jsDocTags && Object.keys(jsDocTags).length > 0 ? jsDocTags : undefined;
}

function getComponentTags(
  componentManifest: Pick<ComponentManifest | SubcomponentManifest, 'jsDocTags'>,
  parsedDocgen: ParsedDocgen | undefined
): JsDocTags | undefined {
  return getNonEmptyJsDocTags(componentManifest.jsDocTags) ?? parsedDocgen?.tags;
}

function formatTagName(tagName: string): string {
  return tagName.charAt(0).toUpperCase() + tagName.slice(1);
}

function formatJsDocTagBlockquote(tagName: string, values: string[]): string[] {
  const described = values.filter((value) => value.trim());

  return (described.length > 0 ? described : ['']).flatMap((value) => {
    const [firstLine, ...remainingLines] = value.trim().split('\n');
    const label = formatTagName(tagName);
    return [
      firstLine ? `> **${label}:** ${firstLine}` : `> **${label}**`,
      ...remainingLines.map((line) => (line ? `> ${line}` : '>')),
    ];
  });
}

function isTopJsDocTag(tagName: string): boolean {
  return TOP_JSDOC_TAG_NAMES.has(tagName);
}

function isGenericJsDocTag(tagName: string): boolean {
  return (
    !TOP_JSDOC_TAG_NAMES.has(tagName) &&
    tagName !== EXAMPLE_JSDOC_TAG_NAME &&
    !HIDDEN_JSDOC_TAG_NAMES.has(tagName)
  );
}

function formatJsDocTags(
  jsDocTags: JsDocTags | undefined,
  includeTag: (tagName: string) => boolean
): string[] {
  const parts: string[] = [];

  for (const [tagName, values] of Object.entries(jsDocTags ?? {})) {
    if (includeTag(tagName)) {
      parts.push(...formatJsDocTagBlockquote(tagName, values));
    }
  }

  if (parts.length > 0) {
    parts.push('');
  }

  return parts;
}

function formatExampleJsDocTags(jsDocTags: JsDocTags | undefined): string[] {
  const examples = jsDocTags?.[EXAMPLE_JSDOC_TAG_NAME];

  if (!examples || examples.length === 0) {
    return [];
  }

  return examples.flatMap((example) => ['**Example:**', '```', example, '```', '']);
}

/**
 * Formats a story's content (description + code snippet) into markdown.
 * Reusable helper for both formatComponentManifest and formatStoryDocumentation.
 */
function formatStoryContent(story: Story, importStatement: string | undefined): string[] {
  const parts: string[] = [];

  if (story.description) {
    parts.push(story.description);
    parts.push('');
  }

  parts.push('```');
  if (importStatement) {
    parts.push(importStatement);
    parts.push('');
  }
  parts.push(story.snippet ?? '');
  parts.push('```');

  return parts;
}

function formatPropsSection(
  parsedDocgen: ParsedDocgen | undefined,
  options: { title?: string; typeName?: string } = {}
): string[] {
  const propEntries = parsedDocgen ? Object.entries(parsedDocgen.props) : [];

  if (propEntries.length === 0) {
    return [];
  }

  const title = options.title ?? '## Props';
  const typeName = options.typeName ?? 'Props';
  const parts: string[] = [];
  parts.push(title);
  parts.push('');
  parts.push('```');
  parts.push(`export type ${typeName} = {`);

  for (const [propName, propInfo] of propEntries) {
    const type = propInfo.type ?? 'any';
    const isRequired = propInfo.required ?? true;
    const hasDefault = propInfo.defaultValue !== undefined;
    const hasDescription = propInfo.description !== undefined;

    if (hasDescription) {
      parts.push('  /**');
      parts.push(`    ${propInfo.description}`);
      parts.push('  */');
    }

    let propLine = `  ${propName}`;
    if (!isRequired) {
      propLine += '?';
    }

    propLine += `: ${type}`;

    if (hasDefault) {
      propLine += ` = ${propInfo.defaultValue}`;
    }

    propLine += ';';
    parts.push(propLine);
  }

  parts.push('}');
  parts.push('```');
  parts.push('');

  return parts;
}

const FENCE_LINE = /^\s*(?:```|~~~)/;
const HEADING_LINE = /^(#{1,4}) /;

/** Nests a framework's own `##` sections under the `### <subcomponent>` heading they render inside. */
function demoteHeadings(markdown: string): string {
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (FENCE_LINE.test(line)) {
        inFence = !inFence;
        return line;
      }
      return inFence ? line : line.replace(HEADING_LINE, '##$1 ');
    })
    .join('\n');
}

function formatSubcomponentsSection(
  subcomponents: Record<string, SubcomponentManifest> | undefined
): string[] {
  if (!subcomponents || Object.keys(subcomponents).length === 0) {
    return [];
  }

  const parts: string[] = [];
  parts.push('## Subcomponents');
  parts.push('');

  for (const [key, subcomponent] of Object.entries(subcomponents)) {
    const parsedDocgen = getParsedDocgen(subcomponent);
    const jsDocTags = getComponentTags(subcomponent, parsedDocgen);

    parts.push(`### ${subcomponent.name || key}`);
    parts.push('');
    parts.push(...formatJsDocTags(jsDocTags, isTopJsDocTag));

    if (subcomponent.summary) {
      parts.push(subcomponent.summary);
      parts.push('');
    }

    if (subcomponent.description) {
      parts.push(subcomponent.description);
      parts.push('');
    }

    parts.push(...formatJsDocTags(jsDocTags, isGenericJsDocTag));
    parts.push(...formatExampleJsDocTags(jsDocTags));

    if (subcomponent.import) {
      parts.push('```');
      parts.push(subcomponent.import);
      parts.push('```');
      parts.push('');
    }

    if (subcomponent.error) {
      parts.push(`Error: ${subcomponent.error.name}`);
      parts.push('');
      parts.push('```');
      parts.push(subcomponent.error.message);
      parts.push('```');
      parts.push('');
      continue;
    }

    if (subcomponent.apiDescription) {
      parts.push(demoteHeadings(subcomponent.apiDescription));
      parts.push('');
      continue;
    }

    const typeName = `${(subcomponent.name || key).replace(/\W+/g, '')}Props`;
    parts.push(...formatPropsSection(parsedDocgen, { title: '#### Props', typeName }));
  }

  return parts;
}

/**
 * Format a single component manifest into markdown.
 */
export function formatComponentManifest(componentManifest: ComponentManifest): string {
  const parts: string[] = [];
  const parsedDocgen = getParsedDocgen(componentManifest);
  const jsDocTags = getComponentTags(componentManifest, parsedDocgen);

  // Component header
  parts.push(`# ${componentManifest.name}`);
  parts.push('');
  parts.push(`ID: ${componentManifest.id}`);
  parts.push('');
  parts.push(...formatJsDocTags(jsDocTags, isTopJsDocTag));

  // Description section
  if (componentManifest.description) {
    parts.push(componentManifest.description);
    parts.push('');
  }

  parts.push(...formatJsDocTags(jsDocTags, isGenericJsDocTag));
  parts.push(...formatExampleJsDocTags(jsDocTags));

  parts.push(...formatSubcomponentsSection(componentManifest.subcomponents));

  // A framework's own API markdown leads, because it is the component's contract and the stories
  // below are examples of applying it. The `react*` props section keeps its historical position.
  const { apiDescription } = componentManifest;
  if (apiDescription) {
    parts.push(apiDescription);
    parts.push('');
  }

  // Stories section
  const stories = Array.isArray(componentManifest.stories) ? componentManifest.stories : [];
  if (stories.length > 0) {
    parts.push('## Stories');
    parts.push('');

    const storiesWithSnippets = stories.filter((s) => s.snippet);

    // Check if component has props - if not, show all stories fully
    const hasProps =
      !!apiDescription || (parsedDocgen && Object.keys(parsedDocgen.props).length > 0);

    const storiesToShow = hasProps
      ? storiesWithSnippets.slice(0, MAX_STORIES_TO_SHOW)
      : storiesWithSnippets;

    // Everything not shown in full is still named and addressable by story id, snippet or not:
    // a component whose snippets could not be extracted must not read as having no stories.
    const shown = new Set(storiesToShow);
    const remainingStories = stories.filter((story) => !shown.has(story));

    // Show first X stories in full detail (or all if no props)
    for (const story of storiesToShow) {
      parts.push(`### ${story.name}`);
      parts.push('');
      if (story.id) {
        parts.push(`Story ID: ${story.id}`);
        parts.push('');
      }
      parts.push(...formatStoryContent(story, componentManifest.import));
      parts.push('');
    }

    // Show remaining stories as names only
    if (remainingStories.length > 0) {
      if (storiesToShow.length > 0) {
        parts.push('### Other Stories');
        parts.push('');
      }
      for (const story of remainingStories) {
        const summary = extractSummary(story);
        const summaryPart = summary ? `: ${summary}` : '';
        const storyLabel = story.id ? `${story.name} (${story.id})` : story.name;
        parts.push(`- ${storyLabel}${summaryPart}`);
      }
      parts.push('');
    }
  }

  if (!apiDescription) {
    parts.push(...formatPropsSection(parsedDocgen));
  }

  // Attached docs section
  if (componentManifest.docs && Object.keys(componentManifest.docs).length > 0) {
    const docsWithContent = Object.values(componentManifest.docs).filter(
      (doc) => (doc.content ?? '').trim().length > 0
    );

    if (docsWithContent.length > 0) {
      parts.push('## Docs');
      parts.push('');

      for (const doc of docsWithContent) {
        parts.push(`### ${doc.name}`);
        parts.push('');

        parts.push(doc.content ?? '');
        parts.push('');
      }
    }
  }

  return parts.join('\n').trim();
}

/**
 * Format a single doc manifest into markdown.
 */
export function formatDocsManifest(doc: Doc): string {
  return dedent`# ${doc.title ?? doc.name}

			${doc.content ?? ''}`;
}

/**
 * Format a component manifest map into a markdown list.
 * @param manifest - The component manifest map to format
 * @returns Formatted string representation of the component list
 */
export function formatManifestsToLists(
  manifests: AllManifests,
  options: ListFormattingOptions = {}
): string {
  const parts: string[] = [];

  parts.push('# Components');
  parts.push('');
  for (const component of Object.values(manifests.componentManifest.components)) {
    parts.push(formatComponentLine(component));
    if (options.withStoryIds && Array.isArray(component.stories)) {
      for (const story of component.stories) {
        parts.push(formatStorySubLine(story));
      }
    }
  }
  parts.push('');

  if (!manifests.docsManifest) {
    return parts.join('\n').trim();
  }

  parts.push('# Docs');
  parts.push('');
  for (const doc of Object.values(manifests.docsManifest.docs)) {
    parts.push(formatDocLine(doc));
  }

  return parts.join('\n').trim();
}

/**
 * Formats one listing per composed source.
 *
 * Sources are grouped under their own heading rather than merged, because ids are only unique
 * within a source and the follow-up tools take a `storybookId`. A source that failed or needs its
 * own endpoint prints that in place of its listing, so the rest still reads.
 */
export function formatMultiSourceManifestsToLists(
  sources: SourceListing[],
  options: ListFormattingOptions = {}
): string {
  const parts: string[] = [];

  for (const { source, manifests, error, notice } of sources) {
    parts.push(`# ${source.title}`);
    parts.push(`id: ${source.id}`);
    parts.push('');

    if (error) {
      parts.push(`error: ${error}`);
      parts.push('');
      continue;
    }

    if (notice) {
      parts.push(formatRequiresOwnMcpNotice(source, notice.endpoint, { includeHeader: false }));
      parts.push('');
      continue;
    }

    const components = Object.values(manifests?.componentManifest.components ?? {});
    if (components.length > 0) {
      parts.push('## Components');
      parts.push('');
      for (const component of components) {
        parts.push(formatComponentLine(component));
        if (options.withStoryIds && Array.isArray(component.stories)) {
          for (const story of component.stories) {
            parts.push(formatStorySubLine(story));
          }
        }
      }
      parts.push('');
    }

    const docs = Object.values(manifests?.docsManifest?.docs ?? {});
    if (docs.length > 0) {
      parts.push('## Docs');
      parts.push('');
      for (const doc of docs) {
        parts.push(formatDocLine(doc));
      }
      parts.push('');
    }
  }

  return parts.join('\n').trim();
}

/**
 * Format a single story's documentation.
 */
export function formatStoryDocumentation(
  componentManifest: ComponentManifest,
  storyName: string
): string {
  const story = Array.isArray(componentManifest.stories)
    ? componentManifest.stories.find((s) => s.name === storyName)
    : undefined;

  if (!story) {
    return '';
  }

  const parts: string[] = [];

  // Component name - Story name header
  parts.push(`# ${componentManifest.name} - ${story.name}`);
  parts.push('');

  // A story with no snippet still exists and is worth naming; saying so beats an empty answer,
  // which reads as a broken tool rather than as missing data.
  if (!story.snippet) {
    if (story.id) {
      parts.push(`Story ID: ${story.id}`);
      parts.push('');
    }
    if (story.description) {
      parts.push(story.description);
      parts.push('');
    }
    parts.push('No code snippet was extracted for this story.');
    return parts.join('\n').trim();
  }

  parts.push(...formatStoryContent(story, componentManifest.import));

  return parts.join('\n').trim();
}
