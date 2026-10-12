// @vitest-environment happy-dom
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { sanitize, storyNameFromExport } from 'storybook/internal/csf';
import type { Args, IndexEntry } from 'storybook/internal/types';
import type { DocgenPayload } from 'storybook/open-service';

import { composeStories, setProjectAnnotations } from '@storybook/vue3';
import { buildStoryDocsPayload } from '@storybook/vue3/internal/docgen';
import { defineComponent, h } from 'vue';
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc';

import { fillTemplate } from '../../../../../renderers/vue3/src/docs/fill-template.ts';
import { parseArgTypesSnapshot } from '../../compare/parse-snapshot.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const DOCGEN_FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '__testfixtures__');
const STORIES_FILE = 'input.stories.ts';

type FixtureCase = {
  label: string;
  name: string;
  testDir: string;
  tree: 'story-docs' | 'docgen';
};
type FixtureArgTypes = NonNullable<DocgenPayload['argTypes']>;

/** A directory is a fixture only if it holds a story file, so stray tooling dirs stay out. */
function fixtureCases(fixturesDir: string): string[] {
  return readdirSync(fixturesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(fixturesDir, name, STORIES_FILE)))
    .sort();
}

function storyDocsFixtureCases(): FixtureCase[] {
  return fixtureCases(FIXTURES_DIR).map((name) => ({
    label: name,
    name,
    testDir: resolve(FIXTURES_DIR, name),
    tree: 'story-docs' as const,
  }));
}

function docgenFixtureCases(): FixtureCase[] {
  return fixtureCases(DOCGEN_FIXTURES_DIR).map((name) => ({
    label: `docgen/${name}`,
    name,
    testDir: resolve(DOCGEN_FIXTURES_DIR, name),
    tree: 'docgen' as const,
  }));
}

function docgenForFixture(
  fixtureCase: string,
  id: string,
  path: string
): DocgenPayload | undefined {
  if (fixtureCase === 'docgen-unavailable' || fixtureCase === 'no-component') {
    return undefined;
  }

  const argTypesByFixture: Record<string, FixtureArgTypes> = {
    'event-listener': {
      default: argType('default', 'slots'),
      formatter: argType('formatter', 'props'),
      label: argType('label', 'props'),
      submit: argType('submit', 'events'),
    },
    'function-slot': {
      default: argType('default', 'slots'),
    },
    'function-slot-bail': {
      default: argType('default', 'slots'),
      footer: argType('footer', 'slots'),
    },
    'h-args-expression': {
      count: argType('count', 'props'),
      label: argType('label', 'props'),
    },
    'prop-slot-collision': {
      default: argType('default', 'props'),
      icon: argType('icon', 'props'),
    },
    'setup-computed': {
      hint: argType('hint', 'props'),
      label: argType('label', 'props'),
    },
    'setup-local-helper-bail': {
      badge: argType('badge', 'props'),
      label: argType('label', 'props'),
    },
    'setup-ref-plus-handler': {
      count: argType('count', 'props'),
      increment: argType('increment', 'events'),
      label: argType('label', 'props'),
    },
    'setup-renamed-args': {
      label: argType('label', 'props'),
      title: argType('title', 'props'),
    },
    'slot-scoped': {
      item: argType('item', 'slots'),
    },
    slots: {
      default: argType('default', 'slots'),
      header: argType('header', 'slots'),
    },
    'template-escaped-interpolation': {
      label: argType('label', 'props'),
    },
    'template-unset-args': {
      clear: argType('clear', 'events'),
      hint: argType('hint', 'props'),
      id: argType('id', 'props'),
      label: argType('label', 'props'),
      modelValue: argType('modelValue', 'props'),
      'update:modelValue': argType('update:modelValue', 'events'),
    },
    'template-v-model-expansion': {
      label: argType('label', 'props'),
      'update:modelValue': argType('update:modelValue', 'events'),
    },
    'v-model': {
      'update:checked': argType('update:checked', 'events'),
      'update:modelValue': argType('update:modelValue', 'events'),
    },
  };
  // Deliberately empty: vue-component-meta does not surface component-level tags, so the
  // `import-override` fixture has to earn its snapshot from the `@import` tag on its CSF meta.
  return {
    id,
    name: componentNameFromFixture(fixtureCase),
    path,
    jsDocTags: {},
    argTypes: argTypesByFixture[fixtureCase] ?? {},
  };
}

function argType(name: string, category: string): FixtureArgTypes[string] {
  return {
    name,
    table: {
      category,
    },
    type: {
      name: 'other',
      value: 'unknown',
    },
  };
}

/** Feed the real extracted argTypes so docgen-tree baselines exercise snippet synthesis. */
function docgenFromArgTypesSnapshot(
  testDir: string,
  id: string,
  path: string
): DocgenPayload | undefined {
  const argTypesPath = join(testDir, 'cm-argtypes.snapshot');
  if (!existsSync(argTypesPath)) {
    return undefined;
  }

  const sfcFile = readdirSync(testDir).find((file) => file.endsWith('.vue'));
  return {
    id,
    name: sfcFile ? sfcFile.replace(/\.vue$/, '') : id,
    path,
    jsDocTags: {},
    argTypes: parseArgTypesSnapshot(readFileSync(argTypesPath, 'utf8'), argTypesPath),
  };
}

function componentNameFromFixture(fixtureCase: string): string {
  return fixtureCase
    .split('-')
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join('');
}

function makeStoryIndexEntry(importPath: string, title: string): IndexEntry {
  const componentId = title.split('/').at(-1)!.replace(/\s+/g, '').toLowerCase();
  return {
    id: `${componentId}--primary`,
    name: 'Primary',
    title,
    type: 'story',
    subtype: 'story',
    importPath,
  };
}

async function buildFixturePayload({ name, testDir, tree }: FixtureCase) {
  const importPath = resolve(testDir, STORIES_FILE);
  return buildStoryDocsPayload(
    {
      entry: makeStoryIndexEntry(importPath, `Forms/${name}`),
    },
    {
      readDocgen: async (id) =>
        tree === 'story-docs'
          ? docgenForFixture(name, id, importPath)
          : docgenFromArgTypesSnapshot(testDir, id, importPath),
    }
  );
}

async function expectPayloadSnapshot(fixtureCase: FixtureCase): Promise<void> {
  const payload = await buildFixturePayload(fixtureCase);
  const { testDir } = fixtureCase;
  await expect(payload ? { ...payload, path: '__PATH__' } : payload).toMatchFileSnapshot(
    join(testDir, 'story-docs.payload.snapshot')
  );
}

setProjectAnnotations([]);

describe('vue3 story-docs payload baselines', () => {
  it.each([...storyDocsFixtureCases(), ...docgenFixtureCases()])('$label', expectPayloadSnapshot);
});

const isPlainArg = (value: unknown) =>
  typeof value === 'string'
    ? !/["'\n]/.test(value)
    : value === undefined || value === null || ['number', 'boolean'].includes(typeof value);

// Filling lays a long attribute list out one per line, where the snippet keeps it on one line.
const joinAttributeLines = (code: string) =>
  code.replace(/<[A-Za-z][^>]*>/g, (tag) => tag.replace(/\s*\n\s*/g, ' ').replace(/ >$/, '>'));

// Its stories read a function the fixture only declares, so the module cannot be imported.
const UNLOADABLE_FIXTURES = new Set(['args-references']);

// Stories with a template and a complete snippet, with the args they render with.
const liveStories = (
  await Promise.all(
    [...storyDocsFixtureCases(), ...docgenFixtureCases()]
      .filter(({ name }) => !UNLOADABLE_FIXTURES.has(name))
      .map(async (fixtureCase) => {
        const payload = await buildFixturePayload(fixtureCase);
        const stories: Parameters<typeof composeStories>[0] = await import(
          join(fixtureCase.testDir, STORIES_FILE)
        );
        const composed = Object.entries(composeStories(stories) as Record<string, { args: Args }>);
        return Object.values(payload?.stories ?? {}).flatMap(
          ({ id, template, snippet, warning }) => {
            // A composed story is named after its export, so it is found by the id that name makes.
            const args = composed.find(([name]) =>
              id.endsWith(`--${sanitize(storyNameFromExport(name))}`)
            )?.[1].args;
            return template !== undefined && snippet !== undefined && warning === undefined && args
              ? [{ id, template, snippet, args }]
              : [];
          }
        );
      })
  )
).flat();

const roundTrips = liveStories.filter(({ args }) => Object.values(args).every(isPlainArg));

const fill = (id: string, args: Args) =>
  fillTemplate(liveStories.find((story) => story.id === id)!.template, args);

function compileErrors(code: string): string[] {
  const { descriptor, errors } = parse(code);
  try {
    if (descriptor.scriptSetup) {
      compileScript(descriptor, { id: 'story' });
    }
  } catch (error) {
    errors.push(error as Error);
  }
  const template = descriptor.template
    ? compileTemplate({ source: descriptor.template.content, filename: 'Story.vue', id: 'story' })
    : undefined;
  return [...errors, ...(template?.errors ?? [])].map(String);
}

describe('vue3 live templates', () => {
  it('round-trips the stories with plain args', () => {
    expect(roundTrips.map(({ id }) => id)).toMatchInlineSnapshot(`
      [
        "forms-args-formatting--unset-arg",
        "forms-as-cast--primary",
        "forms-basic--primary",
        "forms-csf1-legacy--assigned-args",
        "forms-csf1-legacy--assigned-args-override-inline",
        "forms-csf4--primary",
        "forms-csf4--empty",
        "forms-h-args-expression--primary",
        "forms-import-override--primary",
        "forms-import-override-render--primary",
        "forms-prop-slot-collision--primary",
        "forms-render-function--primary",
        "forms-render-function--nested",
        "forms-render-function--spread-override",
        "forms-render-function--args-member",
        "forms-render-function--slot-children",
        "forms-render-function--args-on-wrapper-and-component",
        "forms-render-setup-h--primary",
        "forms-setup-computed--primary",
        "forms-setup-ref-plus-handler--primary",
        "forms-setup-renamed-args--primary",
        "forms-slots--primary",
        "forms-template-escaped-interpolation--primary",
        "forms-template-inherit-attrs--primary",
        "forms-template-meta-render--primary",
        "forms-template-meta-render--secondary",
        "forms-template-string--primary",
        "forms-template-string--assigned-args",
        "forms-template-unset-args--primary",
        "forms-template-v-model-expansion--primary",
        "forms-v-model--primary",
        "forms-cross-file-composed-utility--props-as-written",
        "forms-cross-file-extended-interface--props-as-written",
        "forms-cross-file-imported-interface--props-as-written",
        "forms-cross-file-props-spread--props-as-written",
        "forms-cross-file-runtime-props--props-as-written",
        "forms-cross-file-union-alias--props-as-written",
        "forms-define-expose--props-as-written",
        "forms-define-props-destructured--props-as-written",
        "forms-define-props-runtime-array--props-as-written",
        "forms-define-props-runtime-object--props-as-written",
        "forms-define-slots-with-props--props-as-written",
        "forms-expose-event-collision--primary",
        "forms-jsdoc-tags--props-as-written",
        "forms-model-with-runtime-emits--bound",
        "forms-options-api-emits--stepper",
        "forms-prop-slot-name-collision--icon-prop-as-written",
        "forms-props-basic-types--props-as-written",
        "forms-props-union-enum--props-as-written",
        "forms-runtime-multi-constructor--props-as-written",
        "forms-runtime-proptype-cast--props-as-written",
        "forms-slots--string-child",
        "forms-slots-options-api--string-child",
        "forms-slots-template-only--string-child",
        "forms-slots-with-events--string-child",
        "forms-type-intersection-whole--props-as-written",
        "forms-v-model--v-model-binding",
      ]
    `);
  });

  it.each(roundTrips)('$id reads like its snippet when filled with its args', (story) => {
    expect(joinAttributeLines(fillTemplate(story.template, story.args))).toBe(
      joinAttributeLines(story.snippet)
    );
  });

  it.each(liveStories)('$id compiles when filled with its args', (story) => {
    expect(compileErrors(fillTemplate(story.template, story.args))).toEqual([]);
  });

  describe('filled with args a control or mapping can set', () => {
    const Icon = defineComponent({ name: 'Icon', props: ['size'], setup: () => () => null });
    const Badge = { __name: 'Badge', __file: '/abs/path/Badge.vue', setup: () => () => null };

    it('prints functions, objects, quoted strings, VNodes and components as Vue code', () => {
      const filled = fill('forms-basic--primary', {
        label: 'Say "hi"',
        title: "It's",
        both: `It's "fine"`,
        lines: 'one\ntwo',
        tags: ['a', 'b'],
        style: { color: 'red' },
        onClick: () => {},
        format: (value: string) => value,
        icon: h(Icon, { size: 2 }),
        as: Badge,
      });
      expect(compileErrors(filled)).toEqual([]);
      expect(filled).toMatchInlineSnapshot(`
        "<script lang="ts" setup>
        import BasicButton from './BasicButton.vue';
        </script>

        <template>
          <BasicButton
            :as="Badge"
            :both="'It\\'s &quot;fine&quot;'"
            :icon="h(Icon, { size: 2 })"
            label='Say "hi"'
            :lines="'one\\ntwo'"
            :style="{ color: 'red' }"
            :tags="['a', 'b']"
            title="It's"
            @click="onClick"
          />
        </template>"
      `);
    });

    it('prints slot args as slot content', () => {
      const filled = fill('forms-slots--primary', {
        default: h('strong', null, ['Bold ', h(Icon, { size: 1 })]),
        header: 'Say "hi" & {{ x }}',
        footer: { n: 1 },
      });
      expect(compileErrors(filled)).toEqual([]);
      expect(filled).toMatchInlineSnapshot(`
        "<script lang="ts" setup>
        import SlotsPanel from './SlotsPanel.vue';
        </script>

        <template>
          <SlotsPanel :footer="{ n: 1 }">
            <strong>Bold <Icon :size="1" /></strong>
            <template #header>
              Say "hi" &amp; &#123;&#123; x }}
            </template>
          </SlotsPanel>
        </template>"
      `);
    });

    it('prints quoted strings and unset args in the setup and its bindings', () => {
      const filled = fill('forms-setup-computed--primary', { label: `It's "x"` });
      expect(compileErrors(filled)).toEqual([]);
      expect(filled).toMatchInlineSnapshot(`
        "<script lang="ts" setup>
        import { computed } from "vue";
        import SetupComputed from './SetupComputed.vue';

        const upper = computed(() => 'It\\'s "x"'.toUpperCase());
        </script>

        <template>
          <SetupComputed :label="'It\\'s &quot;x&quot;'" :hint="upper" />
        </template>"
      `);
      expect(compileErrors(fill('forms-setup-computed--primary', {}))).toEqual([]);
    });
  });
});
