import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import ts from 'typescript';

import { buildDocgenPayload } from './build-docgen.ts';
import { VueComponentMetaManager } from './component-meta/vue-project-manager.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

// One manager for the suite — checker construction is the expensive part, and one manager per
// worker lifetime is exactly the production shape.
const manager = new VueComponentMetaManager(ts);
afterAll(() => manager.dispose());

const entryFor = (importPath: string, title: string) =>
  ({
    type: 'story',
    subtype: 'story',
    id: title.toLowerCase().replace(/\W+/g, '-'),
    name: 'Default',
    title,
    importPath,
    tags: [],
  }) as unknown as IndexEntry;

const docgenFor = (importPath: string, title: string) =>
  buildDocgenPayload(
    { entry: entryFor(importPath, title) },
    {
      getChecker: (componentPath) => manager.getCheckerForFile(componentPath),
      resolvePath: (path) => join(fixturesDir, path),
      typescript: ts,
    }
  );

describe('buildDocgenPayload subcomponents', () => {
  it('documents each declared subcomponent through the primary extraction chain', async () => {
    const payload = await docgenFor('./subcomponents/Card.stories.ts', 'Example/Card');

    expect(payload?.error).toBeUndefined();
    const header = payload?.subcomponents?.Header;
    expect(header).toBeDefined();
    expect(header?.name).toBe('CardHeader');
    expect(header?.path).toContain('CardHeader.vue');
    expect(header?.renderer).toBe('vue3');
    // The child's own props are extracted, not the parent's.
    expect(header?.argTypes?.heading).toMatchObject({
      description: 'Heading text rendered above the card body.',
      type: { name: 'string', required: true },
    });
    expect(header?.argTypes?.content).toBeUndefined();
    // Vue populates the child's apiDescription (deliberately richer than React's subcomponents).
    expect(header?.apiDescription).toContain('## Props');
    // And the payload still satisfies the worker transport.
    expect(() => structuredClone(payload)).not.toThrow();
  });

  it('keeps the primary component docgen untouched beside declared subcomponents', async () => {
    const payload = await docgenFor('./subcomponents/Card.stories.ts', 'Example/Card');

    expect(payload?.argTypes?.content).toBeDefined();
    expect(payload?.argTypes?.heading).toBeUndefined();
    expect(payload?.renderer).toBe('vue3');
  });

  it('isolates a failed subcomponent to its entry error', async () => {
    const payload = await docgenFor(
      './subcomponents/CardMissing.stories.ts',
      'Example/CardMissing'
    );

    expect(payload?.error).toBeUndefined();
    expect(payload?.subcomponents?.Missing?.error?.name).toBe('No component import found');
    // The entry error names the failed meta.subcomponents key, not the primary meta.component.
    const message = payload?.subcomponents?.Missing?.error?.message ?? '';
    expect(message).toContain('meta.subcomponents.Missing');
    expect(message).not.toContain('meta.component');
    expect(payload?.argTypes?.content).toBeDefined();
  });

  it('omits the subcomponents key when the meta declares none', async () => {
    const payload = await docgenFor('./Button.stories.ts', 'Example/Button');

    expect(payload?.error).toBeUndefined();
    expect(payload && 'subcomponents' in payload).toBe(false);
  });
});
