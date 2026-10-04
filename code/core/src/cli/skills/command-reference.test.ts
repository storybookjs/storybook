import { describe, expect, it } from 'vitest';

import * as v from 'valibot';

import { defineToolset } from '../../shared/open-service/toolset-definition.ts';
import { renderMethodHelpFromCatalog } from '../tools/help.ts';
import { toCatalogEntry } from '../tools/sdk/catalog.ts';
import { renderCommandReference } from './command-reference.ts';

const handler = async () => ({ ok: true as const, data: {}, markdown: '' });

const catalogEntry = (id: string, descriptions: Record<string, string>) =>
  toCatalogEntry(
    defineToolset({
      id,
      description: `${id} tools.`,
      methods: Object.fromEntries(
        Object.entries(descriptions).map(([name, description]) => [
          name,
          { title: name, description, input: v.object({}), handler },
        ])
      ),
    }),
    { transport: 'cli', getService: () => ({}) as never }
  );

const docs = catalogEntry('docs', {
  list: 'List components. Then call `npx storybook tools docs show`.',
  show: 'Show one component. For one story, use `npx storybook tools docs show-story`.',
  showStory: 'Show one story.',
});
const review = catalogEntry('review', {
  create: 'Create a review. Find ids with `npx storybook tools docs list`.',
});

const described = (reference: string) =>
  [...reference.matchAll(/^Usage: npx storybook tools (.+) \[--key value \.\.\.\]$/gm)].map(
    ([, command]) => command
  );

describe('renderCommandReference', () => {
  it('describes each tool the output names with its `--help` output', () => {
    const reference = renderCommandReference('Call `npx storybook tools docs list`.', [
      docs,
      review,
    ]);

    expect(described(reference)).toEqual(['docs list', 'docs show', 'docs show-story']);
    expect(reference).toContain(
      `\`\`\`text\n${renderMethodHelpFromCatalog(docs.methods[1])}\n\`\`\``
    );
  });

  it('does not take a longer command for the one it starts with', () => {
    const reference = renderCommandReference('Call `npx storybook tools docs show-story`.', [docs]);

    expect(described(reference)).toEqual(['docs show-story']);
  });

  it('follows entries only into toolsets the text names', () => {
    const reference = renderCommandReference('Call `npx storybook tools review create`.', [
      docs,
      review,
    ]);

    expect(described(reference)).toEqual(['review create']);
  });

  it('is empty when the text names no tool', () => {
    expect(renderCommandReference('Run `npx storybook tools --help`.', [docs])).toBe('');
  });
});
