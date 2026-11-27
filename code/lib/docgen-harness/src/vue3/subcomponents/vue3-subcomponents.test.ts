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

    // The whole page MCP's `docs-show` returns for Card. Core synthesizes `## Subcomponents`, adds
    // `### CardHeader`, and demotes the child's own `##` sections to `####`, while Card's `## Props`
    // stays put. Unlike the flat own-api snapshot above, this one diffs if that composition breaks.
    await expect(rendered).toMatchFileSnapshot(
      join(fixturesDir, 'declared-subcomponents', 'composed-render.snapshot')
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
