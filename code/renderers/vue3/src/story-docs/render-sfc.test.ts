import { describe, expect, it } from 'vitest';

import { babelParse, types as t } from 'storybook/internal/babel';

import type { ClassifiedArg } from './classify-args.ts';
import { renderSfcSnippet } from './render-sfc.ts';

describe('renderSfcSnippet', () => {
  it.each<[input: string, output: string]>([
    [`'Hello'`, 'label="Hello"'],
    [`'She said "hi"'`, `label='She said "hi"'`],
    ['3', ':label="3"'],
    ['true', 'label'],
    ['false', ':label="false"'],
    ['null', ':label="null"'],
  ])('%s -> %s', (input, output) => {
    expect(render([prop('label', input)])).toBe(`<script lang="ts" setup>
import C from './C.vue';
</script>

<template>
  <C ${output} />
</template>`);
  });

  it('hoists a value that needs script scope, indented like the snippet around it', () => {
    expect(render([prop('options', `{\n    tone: "neutral"\n}`, 'hoist')]))
      .toBe(`<script lang="ts" setup>
import C from './C.vue';

const options = {
  tone: "neutral"
};
</script>

<template>
  <C :options="options" />
</template>`);
  });

  it('hoists a string that both quote styles cannot delimit', () => {
    expect(render([prop('label', `'She said "hi" and it\\'s fine'`)])).toContain(':label="label"');
  });

  it('declares hoisted bindings in the order their attributes appear', () => {
    const snippet = render(
      [
        prop('aria-label', '{}', 'hoist'),
        prop('ariaLabel', '[]', 'hoist'),
        prop('default', '{}', 'hoist'),
        prop('ref', '{}', 'hoist'),
        model('model-value', `"value"`),
      ],
      'MyComponent'
    );

    expect(snippet).toBe(`<script lang="ts" setup>
import { ref } from "vue";
import MyComponent from './MyComponent.vue';

const ariaLabel = {};

const ariaLabel2 = [];

const _default = {};

const modelValue = ref("value");

const ref2 = {};
</script>

<template>
  <MyComponent :aria-label="ariaLabel" :ariaLabel="ariaLabel2" :default="_default" v-model:model-value="modelValue" :ref="ref2" />
</template>`);
  });

  it('renders slots as children and named slots as templates', () => {
    const snippet = render([slot('header', `'Title'`), slot('default', `'Body'`)]);

    expect(snippet).toBe(`<script lang="ts" setup>
import C from './C.vue';
</script>

<template>
  <C>
    Body
    <template #header>
      Title
    </template>
  </C>
</template>`);
  });

  it('uses the overridden component import inside function slots', () => {
    const result = renderSfcSnippet({
      args: [slot('default', `() => h(C, { label: 'Nested' })`, 'function-slot')],
      componentImportStatement: "import C from '@example/C.vue';",
      componentName: 'C',
      importBindings: new Map([['C', { importId: './C.vue', importName: 'default' }]]),
    });

    expect(result?.snippet).toBe(`<script lang="ts" setup>
import C from '@example/C.vue';
</script>

<template>
  <C>
    <C label="Nested" />
  </C>
</template>`);
  });

  it('interpolates a hoisted slot value', () => {
    const snippet = render([slot('default', `['a']`, 'hoist')]);

    expect(snippet).toContain('{{ _default }}');
  });

  // Entity-escaping the braces keeps them out of the parser's interpolation scan, so the text
  // decodes back to the exact string the story set instead of evaluating as an expression.
  it('escapes inline slot text the template parser would read as markup', () => {
    const snippet = render([slot('default', `'<script>{{ evil }}</script>'`)]);

    expect(snippet).toContain('<C>\n    &lt;script&gt;&#123;&#123; evil }}&lt;/script&gt;\n  </C>');
    expect(snippet).toContain("import C from './C.vue';");
  });

  it('escapes an inlined slot string so it stays text', () => {
    const snippet = render([slot('default', `'a < b'`)]);

    expect(snippet).toContain('<C>\n    a &lt; b\n  </C>');
  });

  it('hoists inline slot text whose whitespace raw template text would condense', () => {
    const snippet = render([slot('default', `'  padded  '`)]);

    expect(snippet).toContain('const _default = "  padded  ";');
    expect(snippet).toContain('{{ _default }}');
  });

  it('hoists a listener and renders it as a Vue event binding', () => {
    const snippet = render([event('onSubmit', 'submit', '() => null')]);

    expect(snippet).toBe(`<script lang="ts" setup>
import C from './C.vue';

const onSubmit = () => null;
</script>

<template>
  <C @submit="onSubmit" />
</template>`);
  });

  it('sorts event attributes after prop attributes', () => {
    const snippet = render([event('onSubmit', 'submit', '() => null'), prop('label', `'Send'`)]);

    expect(snippet).toContain('<C label="Send" @submit="onSubmit" />');
  });
});

function render(args: ClassifiedArg[], componentName = 'C'): string {
  return renderSfcSnippet({
    args,
    componentImportStatement: `import ${componentName} from './${componentName}.vue';`,
    componentName,
    importBindings: new Map(),
  })!.snippet.replaceAll('\r\n', '\n');
}

function prop(name: string, code: string, kind: 'hoist' | 'inline' = 'inline'): ClassifiedArg {
  return { name, value: expression(code), role: 'prop', plan: { kind } };
}

function slot(
  name: string,
  code: string,
  kind: 'function-slot' | 'hoist' | 'inline' = 'inline'
): ClassifiedArg {
  return { name, value: expression(code), role: 'slot', plan: { kind } };
}

function model(name: string, code: string): ClassifiedArg {
  return { name, value: expression(code), role: 'model', plan: { kind: 'inline' } };
}

function event(name: string, eventName: string, code: string): ClassifiedArg {
  return {
    name,
    eventName,
    value: expression(code),
    role: 'event',
    plan: { kind: 'hoist' },
  };
}

function expression(code: string): t.Node {
  const file = babelParse(`const value = ${code}`);
  const statement = file.program.body[0];
  if (!t.isVariableDeclaration(statement) || !statement.declarations[0]?.init) {
    throw new Error(`Not an expression: ${code}`);
  }
  return t.removePropertiesDeep(t.cloneNode(statement.declarations[0].init, true, true));
}
