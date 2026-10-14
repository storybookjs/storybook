// @vitest-environment happy-dom
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { sanitize, storyNameFromExport } from 'storybook/internal/csf';
import { UnprintableArgError } from 'storybook/internal/docs-tools';
import type { Args, IndexEntry } from 'storybook/internal/types';
import type { DocgenPayload } from 'storybook/open-service';

import { composeStories, setProjectAnnotations } from '@storybook/vue3';
import { buildStoryDocsPayload } from '@storybook/vue3/internal/docgen';
import * as Vue from 'vue';
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc';
import { renderToString } from 'vue/server-renderer';

import { fillTemplate } from '../../../../../renderers/vue3/src/docs/fill-template.ts';
import { parseArgTypesSnapshot } from '../../compare/parse-snapshot.ts';
import TemplateSharedValues from './__testfixtures__/template-shared-values/TemplateSharedValues.vue';
import * as sharedValuesStories from './__testfixtures__/template-shared-values/input.stories.ts';

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
    'template-shared-values': {
      items: argType('items', 'props'),
      label: argType('label', 'props'),
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

// Its stories read a function the fixture only declares, so the module cannot be imported.
const UNLOADABLE_FIXTURES = new Set(['args-references']);

// Stories with a template, with the args they render with.
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
        return Object.values(payload?.stories ?? {}).flatMap(({ id, template }) => {
          // A composed story is named after its export, so it is found by the id that name makes.
          const args = composed.find(([name]) =>
            id.endsWith(`--${sanitize(storyNameFromExport(name))}`)
          )?.[1].args;
          return template !== undefined && args ? [{ id, template, args }] : [];
        });
      })
  )
).flat();

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

// A story whose args the snippet cannot show falls back to its static snippet.
function fill({ template, args }: { template: string; args: Args }): string | undefined {
  try {
    return fillTemplate(template, args);
  } catch (error) {
    if (error instanceof UnprintableArgError) {
      return undefined;
    }
    throw error;
  }
}

const HOSTILE = 'a"b\'c`d${e}<f>&{{g}}';

// Every value an arg holds changed: a string to one that quotes, escapes and interpolates, a number
// to a negative one and a boolean flipped.
function changed(value: unknown): unknown {
  if (typeof value === 'string') {
    return HOSTILE;
  }
  if (typeof value === 'number') {
    return -1;
  }
  if (typeof value === 'boolean') {
    return !value;
  }
  if (Array.isArray(value)) {
    return value.map(changed);
  }
  return value && Object.getPrototypeOf(value) === Object.prototype && !Vue.isVNode(value)
    ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, changed(entry)]))
    : value;
}

describe('vue3 story templates', () => {
  it.each(liveStories)('$id compiles when filled with its args', (story) => {
    const filled = fill(story);
    expect(filled === undefined ? [] : compileErrors(filled)).toEqual([]);
  });

  it.each(liveStories)('$id compiles when filled with changed args', (story) => {
    const filled = fill({ template: story.template, args: changed(story.args) as Args });
    expect(filled === undefined ? [] : compileErrors(filled)).toEqual([]);
  });
});

// The test build of Vue has no template compiler, so a template is compiled here.
function compiled<T extends { template: string }>(component: T) {
  const { code } = compileTemplate({
    source: component.template,
    filename: 'Story.vue',
    id: 'story',
    compilerOptions: { mode: 'function' },
  });
  return { ...component, render: new Function('Vue', code)(Vue) };
}

// A filled snippet as a component: its script, which imports only from `vue` and the fixture's
// component, runs as the `setup` of its template.
function snippetComponent(code: string) {
  const { descriptor } = parse(code);
  const body = (descriptor.scriptSetup?.content ?? '').replace(/^import .*$/gm, '');
  const names = [...body.matchAll(/^const (\w+)/gm)].map(([, name]) => name);
  const setup = new Function(
    'Vue',
    `const { ref } = Vue;\n${body}\nreturn { ${names.join(', ')} };`
  );
  return compiled({
    components: { TemplateSharedValues },
    setup: () => setup(Vue),
    template: descriptor.template!.content,
  });
}

const renderHtml = (component: object) => renderToString(Vue.createSSRApp(component));

describe('vue3 filled story templates', () => {
  const fixtureCase = storyDocsFixtureCases().find(
    ({ name }) => name === 'template-shared-values'
  )!;

  it.each([
    ['ForEachItem', { items: [{ id: 3 }, { id: 4 }, { id: 5 }] }],
    ['SetupMutation', { items: ['x', 'y'] }],
    ['SpreadWithClass', { label: HOSTILE, class: ['extra'], style: { margin: '1px' } }],
  ] as const)('%s renders as its story', async (name, args) => {
    const payload = await buildFixturePayload(fixtureCase);
    const [, story] = Object.entries(payload?.stories ?? {}).find(([id]) =>
      id.endsWith(`--${sanitize(storyNameFromExport(name))}`)
    )!;
    const filled = fillTemplate(story.template!, structuredClone(args));
    const render = sharedValuesStories[name].render!(structuredClone(args), {} as never);
    expect(await renderHtml(snippetComponent(filled))).toBe(
      await renderHtml(compiled(render as { template: string }))
    );
  });
});
