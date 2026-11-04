import { type SnippetTemplate, formatTemplate } from 'storybook/internal/docs-tools';

/**
 * A story-docs payload with each story's `template` written as one string by `formatTemplate`, so a
 * payload snapshot shows each hole in place in the code. For snapshots only; it is not read back.
 */
export function withReadableTemplates<
  Payload extends { stories: Record<string, { template?: SnippetTemplate<any> }> },
>(payload: Payload): Payload;
export function withReadableTemplates<Payload>(payload: Payload): Payload;
export function withReadableTemplates(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null || !('stories' in payload)) {
    return payload;
  }
  const { stories } = payload as { stories: Record<string, { template?: unknown }> };
  return {
    ...payload,
    stories: Object.fromEntries(
      Object.entries(stories).map(([id, story]) => [
        id,
        Array.isArray(story.template)
          ? { ...story, template: formatTemplate(story.template as SnippetTemplate) }
          : story,
      ])
    ),
  };
}
