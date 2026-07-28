import type { DocgenPayload } from '../docgen/types.ts';
import { selectSnippetForStory } from '../story-docs/snippet.ts';
import type { StoryDoc, StoryDocsPayload } from '../story-docs/types.ts';

/**
 * How many stories `show` renders in full when the docgen payload carries an `apiDescription`.
 */
export const MAX_SHOWN_STORIES_WITH_API_DESCRIPTION = 3;

/** The two service payloads that make up one component's documentation. */
export interface DocsEnvelopeInput {
  id: string;
  docgen?: DocgenPayload;
  storyDocs?: StoryDocsPayload;
}

export interface DocsListEntry {
  id: string;
  name: string;
  summary?: string;
}

/** Drops empty sections and joins the rest with a blank line between them. */
function joinSections(sections: (string | undefined)[]): string {
  return sections.filter((section) => section !== undefined && section !== '').join('\n\n');
}

function fencedSnippet(snippet: string): string {
  return `\`\`\`\n${snippet.trim()}\n\`\`\``;
}

/** Renders one story as a `###` section: name, story id, description, and its snippet. */
function renderStorySection(story: StoryDoc, storyDocs: StoryDocsPayload | undefined): string {
  const snippet = selectSnippetForStory(storyDocs, story.id);
  return joinSections([
    `### ${story.name}`,
    `Story ID: ${story.id}`,
    story.description,
    snippet === undefined ? undefined : fencedSnippet(snippet),
  ]);
}

function storiesOf(storyDocs: StoryDocsPayload | undefined): StoryDoc[] {
  return Object.values(storyDocs?.stories ?? {});
}

function resolveName({ id, docgen, storyDocs }: DocsEnvelopeInput): string {
  return docgen?.name ?? storyDocs?.name ?? id;
}

/**
 * Renders the full documentation for one component.
 *
 * `apiDescription` is inserted verbatim — this module only ever checks whether it is present, never
 * what it contains, so core stays free of framework knowledge. Its presence is also what caps the
 * story section (see {@link MAX_SHOWN_STORIES_WITH_API_DESCRIPTION}).
 */
export function renderComponentDocs(input: DocsEnvelopeInput): string {
  const { id, docgen, storyDocs } = input;
  const apiDescription = docgen?.apiDescription;
  const stories = storiesOf(storyDocs);

  const shown =
    apiDescription === undefined
      ? stories
      : stories.slice(0, MAX_SHOWN_STORIES_WITH_API_DESCRIPTION);
  const remaining = stories.slice(shown.length);

  const storiesSection =
    stories.length === 0
      ? undefined
      : joinSections([
          '## Stories',
          ...shown.map((story) => renderStorySection(story, storyDocs)),
          remaining.length === 0
            ? undefined
            : `Other stories: ${remaining.map((story) => story.name).join(', ')}`,
        ]);

  return joinSections([
    `# ${resolveName(input)}`,
    `ID: ${id}`,
    docgen?.description,
    storiesSection,
    apiDescription,
  ]);
}

/** Renders one story of a component: its name, id, description, and snippet. */
export function renderStoryDocs(input: DocsEnvelopeInput & { storyId: string }): string {
  const { storyId, storyDocs } = input;
  const story = storyDocs?.stories[storyId];

  if (!story) {
    return joinSections([
      `# ${resolveName(input)}`,
      `Story ID: ${storyId}`,
      'No documentation was found for this story.',
    ]);
  }

  return joinSections([
    `# ${resolveName(input)}`,
    `ID: ${input.id}`,
    renderStorySection(story, storyDocs),
  ]);
}

/**
 * Builds the component listing from the docgen and story-docs component maps.
 *
 * Docgen is the primary source; components that only produced story docs still get a row so the
 * listing matches what `show` can answer for.
 */
export function buildDocsList(
  docgenComponents: Record<string, DocgenPayload>,
  storyDocsComponents: Record<string, StoryDocsPayload> = {}
): DocsListEntry[] {
  const ids = [...new Set([...Object.keys(docgenComponents), ...Object.keys(storyDocsComponents)])];

  return ids.map((id) => {
    const docgen = docgenComponents[id];
    const storyDocs = storyDocsComponents[id];
    const summary = docgen?.summary ?? docgen?.description;

    return {
      id,
      name: docgen?.name ?? storyDocs?.name ?? id,
      ...(summary !== undefined ? { summary } : {}),
    };
  });
}
