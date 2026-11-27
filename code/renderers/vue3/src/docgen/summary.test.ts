import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import ts from 'typescript';

import { buildDocgenPayload } from './component-docgen/build-docgen.ts';
import { VueComponentMetaManager } from './component-docgen/component-meta/vue-project-manager.ts';
import { createSummaryProvider } from './docgen-worker.ts';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  'component-docgen/__testfixtures__'
);

// Written here and not kept as a fixture: a file that does not parse fails the formatter.
const brokenDir = mkdtempSync(join(tmpdir(), 'sb-vue-summary-'));
writeFileSync(join(brokenDir, 'Broken.stories.ts'), 'export default { component: ;');

const stories = {
  'a script setup SFC': ['./CastComponent.stories.ts', 'Example/CastComponent'],
  'a script setup SFC with a meta docblock': ['./Button.stories.ts', 'Example/Button'],
  'an options API SFC': ['./summary/OptionsApi.stories.ts', 'Example/OptionsApi'],
  'an options API SFC with a meta docblock': [
    './jsdoc/DescriptionOnlyButton.stories.ts',
    'Example/DescriptionOnlyButton',
  ],
  'an SFC with a script next to its script setup': [
    './summary/Toggle.stories.ts',
    'Example/Toggle',
  ],
  'an SFC that exports a declaration by name': ['./summary/Switch.stories.ts', 'Example/Switch'],
  'an SFC behind a barrel': ['./barrel/src/Barrel.stories.ts', 'Barrel/ViaIndex'],
  'a TS component': ['./summary/Tag.stories.ts', 'Example/Tag'],
  'a TS component with a meta docblock': ['./summary/MetaDocs.stories.ts', 'Example/MetaDocs'],
  'a TS component behind a barrel': ['./summary/Label.stories.ts', 'Example/Label'],
  'a TS component behind a barrel and a cast': [
    './summary/CastLabel.stories.ts',
    'Example/CastLabel',
  ],
  'a TS component that is a default export': ['./summary/Divider.stories.ts', 'Example/Divider'],
  'a TS component exported by an export list': ['./summary/Chip.stories.ts', 'Example/Chip'],
  'a TS component exported by name as the default': [
    './summary/Spacer.stories.ts',
    'Example/Spacer',
  ],
  'a TS component that shares its name with an interface': [
    './summary/Marker.stories.ts',
    'Example/Marker',
  ],
  'a component declared in the story file': ['./summary/Inline.stories.ts', 'Example/Inline'],
  'an import that does not resolve': [
    './MissingImportComponent.stories.ts',
    'Example/MissingImportComponent',
  ],
  'a meta without a component': ['./summary/Hook.stories.ts', 'Hooks/use Thing'],
  'a meta whose component is null': ['./NullComponent.stories.ts', 'Example/NullComponent'],
  'a story file that does not parse': [
    relative(fixturesDir, join(brokenDir, 'Broken.stories.ts')),
    'Example/Broken',
  ],
  'a story file that does not exist': ['./summary/Absent.stories.ts', 'Example/Absent'],
} satisfies Record<string, [importPath: string, title: string]>;

const entryFor = (name: keyof typeof stories): IndexEntry => {
  const [importPath, title] = stories[name];
  return {
    type: 'story',
    subtype: 'story',
    id: `${title.toLowerCase().replace(/\W+/g, '-')}--default`,
    name: 'Default',
    title,
    importPath,
  };
};

const manager = new VueComponentMetaManager(ts);

beforeAll(() => {
  vi.spyOn(process, 'cwd').mockReturnValue(fixturesDir);
});

afterAll(() => {
  vi.restoreAllMocks();
  manager.dispose();
  rmSync(brokenDir, { recursive: true, force: true });
});

it.each(Object.keys(stories) as (keyof typeof stories)[])(
  'summarizes %s as docgen names and describes it',
  { timeout: 60_000 },
  async (name) => {
    const entry = entryFor(name);
    const docgen = await buildDocgenPayload(
      { entry },
      {
        getChecker: (componentPath) => manager.getCheckerForFile(componentPath),
        typescript: ts,
      }
    );
    const [summary] = await createSummaryProvider()([{ entry }]);

    expect({
      name: summary?.name,
      description: summary?.description,
      summary: summary?.summary,
    }).toEqual({
      name: docgen?.name,
      description: docgen?.description,
      summary: docgen?.summary,
    });
  }
);

it('describes the cases above, so the comparison is not of nothing to nothing', async () => {
  const names = Object.keys(stories) as (keyof typeof stories)[];
  const summaries = await createSummaryProvider()(names.map((name) => ({ entry: entryFor(name) })));

  expect(Object.fromEntries(summaries.map((summary, index) => [names[index], summary])))
    .toMatchInlineSnapshot(`
    {
      "a TS component": {
        "description": "A tag that labels an item.",
        "name": "Tag",
        "summary": "for labels",
      },
      "a TS component behind a barrel": {
        "description": "A tag that labels an item.",
        "name": "Label",
        "summary": "for labels",
      },
      "a TS component behind a barrel and a cast": {
        "description": "A tag that labels an item.",
        "name": "Tag",
        "summary": "for labels",
      },
      "a TS component exported by an export list": {
        "description": "Chips as the dashboard uses them.",
        "name": "Chip",
        "summary": undefined,
      },
      "a TS component exported by name as the default": {
        "description": undefined,
        "name": "Spacer",
        "summary": undefined,
      },
      "a TS component that is a default export": {
        "description": "A divider between two sections.",
        "name": "Divider",
        "summary": undefined,
      },
      "a TS component that shares its name with an interface": {
        "description": "What a marker takes.
    A marker that shares its name with an interface.",
        "name": "Marker",
        "summary": undefined,
      },
      "a TS component with a meta docblock": {
        "description": "Tags as the dashboard uses them.",
        "name": "Tag",
        "summary": "for labels",
      },
      "a component declared in the story file": {
        "description": undefined,
        "name": "Inline",
        "summary": undefined,
      },
      "a meta whose component is null": {
        "description": undefined,
        "name": "NullComponent",
        "summary": undefined,
      },
      "a meta without a component": {
        "description": undefined,
        "name": "useThing",
        "summary": undefined,
      },
      "a script setup SFC": {
        "description": undefined,
        "name": "Button",
        "summary": undefined,
      },
      "a script setup SFC with a meta docblock": {
        "description": "A button.",
        "name": "Button",
        "summary": "Clickable",
      },
      "a story file that does not exist": undefined,
      "a story file that does not parse": {
        "description": undefined,
        "name": "Broken",
        "summary": undefined,
      },
      "an SFC behind a barrel": {
        "description": undefined,
        "name": "Badge",
        "summary": undefined,
      },
      "an SFC that exports a declaration by name": {
        "description": "A switch that is exported below its declaration.",
        "name": "Switch",
        "summary": undefined,
      },
      "an SFC with a script next to its script setup": {
        "description": "A toggle that switches a setting on or off.",
        "name": "Toggle",
        "summary": undefined,
      },
      "an import that does not resolve": {
        "description": undefined,
        "name": "MissingButton",
        "summary": undefined,
      },
      "an options API SFC": {
        "description": "Component description only.",
        "name": "DescriptionOnlyButton",
        "summary": undefined,
      },
      "an options API SFC with a meta docblock": {
        "description": "Story-level description.",
        "name": "DescriptionOnlyButton",
        "summary": undefined,
      },
    }
  `);
});
