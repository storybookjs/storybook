import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import ts from 'typescript';
import { createCheckerByJson } from 'vue-component-meta';

import { adaptCoreComponent, formatComponentManifest } from 'storybook/internal/toolsets-docs';

import { CHECKER_OPTIONS, buildDocgenPayload } from '@storybook/vue3/internal/docgen';
import { recordArgTypesSnapshot } from '../../compare/record-argtypes-snapshot.ts';

/**
 * Subcomponent fixtures need their own tree: every recorder over `vue3/__testfixtures__` asserts
 * exactly one SFC per directory, and a composite fixture is a parent plus its children.
 */
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const checker = createCheckerByJson(fixturesDir, { include: ['**/*'] }, CHECKER_OPTIONS);

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const entryFor = (fixtureCase: string, title: string) =>
  ({
    type: 'story',
    subtype: 'story',
    id: title.toLowerCase().replace(/\W+/g, '-'),
    name: 'Default',
    title,
    importPath: `./${fixtureCase}/input.stories.ts`,
    tags: [],
  }) as unknown as IndexEntry;

const docgenFor = (fixtureCase: string, title: string) =>
  buildDocgenPayload(
    { entry: entryFor(fixtureCase, title) },
    {
      getChecker: () => checker,
      resolvePath: (path) => join(fixturesDir, path),
      typescript: ts,
    }
  );

/**
 * The markdown a consumer actually reads: the payload adapted into a component manifest and
 * rendered by core, which is the same composition MCP's `docs-show` serves.
 */
const renderedApiDescriptionFor = async (fixtureCase: string, title: string) =>
  formatComponentManifest(adaptCoreComponent((await docgenFor(fixtureCase, title))!));

describe('vue3 declared subcomponents', () => {
  it('records each declared child’s own argTypes table', async () => {
    const payload = await docgenFor('declared-subcomponents', 'Example/Card');

    const header = payload?.subcomponents?.Header;
    expect(header?.name).toBe('CardHeader');
    expect(header?.error).toBeUndefined();

    // The child's table is recorded exactly as a consumer receives it, so a regression in prop,
    // event, or default extraction for a subcomponent shows up as a snapshot diff.
    await recordArgTypesSnapshot({
      path: join(fixturesDir, 'declared-subcomponents', 'subcomponent-Header-argtypes.snapshot'),
      label: 'declared-subcomponents/subcomponent-Header-argtypes.snapshot',
      candidate: header!.argTypes!,
    });
  });

  it('keeps the primary component’s argTypes table separate from its child’s', async () => {
    const payload = await docgenFor('declared-subcomponents', 'Example/Card');

    await recordArgTypesSnapshot({
      path: join(fixturesDir, 'declared-subcomponents', 'primary-argtypes.snapshot'),
      label: 'declared-subcomponents/primary-argtypes.snapshot',
      candidate: payload!.argTypes!,
    });

    // The parent documents its own props; the child's never leak in (and vice versa).
    expect(Object.keys(payload!.argTypes!)).not.toContain('heading');
    expect(Object.keys(payload!.subcomponents!.Header!.argTypes!)).not.toContain('content');
  });

  it('records the child’s own apiDescription markdown', async () => {
    const payload = await docgenFor('declared-subcomponents', 'Example/Card');

    // This is the child's OWN apiDescription: it documents CardHeader alone and carries no
    // `## Subcomponents` of its own, because the payload record is flat rather than recursive.
    // Core's `formatSubcomponentsSection` synthesizes that heading and demotes the headings
    // below to render this text under `## Subcomponents` › `### CardHeader`.
    await expect(payload?.subcomponents?.Header?.apiDescription).toMatchFileSnapshot(
      join(
        fixturesDir,
        'declared-subcomponents',
        'subcomponent-Header-own-api-description.snapshot'
      )
    );
  });

  it('renders each declared child under its own heading in the composed apiDescription', async () => {
    const rendered = await renderedApiDescriptionFor('declared-subcomponents', 'Example/Card');

    // What MCP's `docs-show` puts in front of a consumer: core synthesizes `## Subcomponents`,
    // names the child, and demotes the child's own `##` sections one level so they nest beneath it.
    expect(rendered).toContain('## Subcomponents');
    expect(rendered).toContain('### CardHeader');
    expect(rendered).toContain('#### Props');
    expect(rendered).toContain('#### Events');

    // The child's documentation survives the demotion intact — JSDoc, unions and defaults included.
    expect(rendered).toContain('/** Heading text rendered above the card body. */');
    expect(rendered).toContain('level?: 2 | 3;');
    expect(rendered).toContain('/** Fired when the header is dismissed. */');

    // Heading levels inside the child's fenced code block are left alone, and the parent keeps its
    // own undemoted `## Props` below the section rather than merging into the child's.
    expect(rendered).toContain('## Props\n\n```\nexport type CardProps');
    expect(rendered.indexOf('## Subcomponents')).toBeLessThan(
      rendered.indexOf('export type CardProps')
    );
  });

  it('renders no subcomponents section when the meta declares none', async () => {
    const rendered = await renderedApiDescriptionFor('no-subcomponents', 'Example/Standalone');

    // An undeclared component's rendered docs are unchanged by this feature: no empty section,
    // no stray heading, and its own props stay at `##`.
    expect(rendered).not.toContain('Subcomponents');
    expect(rendered).not.toContain('###');
    expect(rendered).toContain('## Props');
  });

  it('omits the subcomponents key when the meta declares none', async () => {
    const payload = await docgenFor('no-subcomponents', 'Example/Standalone');

    expect(payload?.argTypes?.label).toBeDefined();
    expect(payload).not.toHaveProperty('subcomponents');
  });

  it('covers every fixture directory', () => {
    expect(fixtureCases).toEqual(['declared-subcomponents', 'no-subcomponents']);
  });
});
