import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';
import {
  collectImportBindings,
  loadCsf,
  normalizeStoryDeclaration,
  resolveRenderFunction,
  resolveReturnedObjectExpression,
} from 'storybook/internal/csf-tools';

import { readTemplateRenderConfig, type TemplateRenderConfig } from './template-render-config.ts';

interface ReadConfigOptions {
  importSource?: string;
  render: string;
}

function readConfig({ importSource, render }: ReadConfigOptions): TemplateRenderConfig | undefined {
  const source = `
${importSource ?? "import MyButton from './MyButton.vue';"}

const meta = {
  component: MyButton,
  title: 'Example/MyButton',
};

export default meta;

export const Primary = {
  ${render}
};
`;
  const csf = loadCsf(source, { makeTitle: () => 'Example/MyButton' }).parse();
  const storyPath = csf._storyDeclarationPath.Primary;
  if (!storyPath) {
    throw new Error('Expected Primary story to parse');
  }

  const normalized = normalizeStoryDeclaration(storyPath);
  if (normalized.type !== 'config') {
    throw new Error('Expected Primary story to be a config story');
  }

  const renderResolution = resolveRenderFunction(normalized.path, storyPath);
  if (renderResolution.kind !== 'resolved') {
    return undefined;
  }

  const renderObject = resolveReturnedObjectExpression(renderResolution.path);
  if (!renderObject || !t.isObjectExpression(renderObject)) {
    return undefined;
  }

  return readTemplateRenderConfig(renderObject, source, collectImportBindings(csf._file.path), {
    componentImportStatement: "import MyButton from './MyButton.vue';",
    componentName: 'MyButton',
  });
}

describe('readTemplateRenderConfig', () => {
  it('reads setup arrow functions that only return args', () => {
    expect(
      readConfig({
        render: `
render: (args) => ({
  components: { MyButton },
  setup: () => ({ args }),
  template: '<MyButton :title="args.title" />',
}),`,
      })?.setupBlock
    ).toEqual({
      argsRefs: [],
      bindings: [],
      end: 0,
      imports: [],
      source: '',
      start: 0,
    });
  });

  it('reads setup locals from setup function properties', () => {
    expect(
      readConfig({
        render: `
render: (args) => ({
  setup: function () {
    const title1 = args.title;
    return { title1 };
  },
  template: '<MyButton :title="title1" />',
}),`,
      })?.setupBlock
    ).toMatchObject({
      argsRefs: [{ name: 'title' }],
      bindings: ['title1'],
      imports: [],
      source: '    const title1 = args.title;',
    });
  });

  it('keeps setup let reassignment in the setup source', () => {
    expect(
      readConfig({
        render: `
render: (args) => ({
  setup() {
    let title = args.title;
    title += ' ok';
    return { title, args };
  },
  template: '<MyButton :title="title" />',
}),`,
      })?.setupBlock
    ).toMatchObject({
      argsRefs: [{ name: 'title' }],
      bindings: ['title'],
      imports: [],
      source: "    let title = args.title;\n    title += ' ok';",
    });
  });

  it('keeps setup multi-declarator consts in the setup source', () => {
    expect(
      readConfig({
        render: `
render: (args) => ({
  setup() {
    const title = args.title, tag = args.titleTag;
    return { title, tag };
  },
  template: '<MyButton :title="title" :title-tag="tag" />',
}),`,
      })?.setupBlock
    ).toMatchObject({
      argsRefs: [{ name: 'title' }, { name: 'titleTag' }],
      bindings: ['title', 'tag'],
      imports: [],
      source: '    const title = args.title, tag = args.titleTag;',
    });
  });

  it('keeps setup comments and author quotes in the setup source', () => {
    expect(
      readConfig({
        render: `
render: () => ({
  setup() {
    const title = "Local title";
    // This comment is part of the snippet users inspect.
    const titleTag = 'h3';
    return { title, titleTag };
  },
  template: '<MyButton :title="title" :title-tag="titleTag" />',
}),`,
      })?.setupBlock?.source
    ).toBe(`    const title = "Local title";
    // This comment is part of the snippet users inspect.
    const titleTag = 'h3';`);
  });

  it.each([
    {
      name: 'parameter present',
      render: `
render: (args) => ({
  setup(value) {
    return { args };
  },
  template: '<MyButton v-bind="args" />',
}),`,
    },
    {
      name: 'renamed return property',
      render: `
render: (args) => ({
  setup() {
    const title = args.title;
    return { label: title, args };
  },
  template: '<MyButton :label="title" />',
}),`,
    },
    {
      name: 'aliased import',
      importSource: `
import { ref as r } from 'vue';
import MyButton from './MyButton.vue';
`,
      render: `
render: (args) => ({
  setup() {
    const selected = r(undefined);
    return { selected, args };
  },
  template: '<MyButton v-model="selected" />',
}),`,
    },
    {
      name: 'unresolvable identifier',
      render: `
render: (args) => ({
  setup() {
    const title = formatTitle(args.title);
    return { title, args };
  },
  template: '<MyButton :title="title" />',
}),`,
    },
    {
      name: 'computed args member',
      render: `
render: (args) => ({
  setup() {
    const title = args[key];
    return { title, args };
  },
  template: '<MyButton :title="title" />',
}),`,
    },
    {
      name: 'returned property that is not args or a declared const',
      render: `
render: (args) => ({
  setup() {
    return { args, state };
  },
  template: '<MyButton v-bind="args" />',
}),`,
    },
    {
      name: 'setup binding named args',
      render: `
render: (args) => ({
  setup() {
    const args = { title: 'Local title' };
    return { args };
  },
  template: '<MyButton :title="args.title" />',
}),`,
    },
    {
      name: 'setup import colliding with a component local',
      importSource: `
import { MyButton } from './components';
`,
      render: `
render: (args) => ({
  components: { MyButton },
  setup() {
    const title = MyButton.name;
    return { title, args };
  },
  template: '<MyButton :title="title" />',
}),`,
    },
  ])('bails when setup has $name', ({ render, importSource }) => {
    expect(readConfig({ importSource, render })).toBeUndefined();
  });
});
