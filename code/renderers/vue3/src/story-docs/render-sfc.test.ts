import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';

import type { ClassifiedArg } from './classify-args.ts';
import { renderSfcSnippet } from './render-sfc.ts';

function prop(name: string, value: t.Node, kind: 'hoist' | 'inline' = 'inline'): ClassifiedArg {
  return { name, value, role: 'prop', plan: { kind } };
}

describe('renderSfcSnippet', () => {
  it.each([
    { label: 'a string', value: t.stringLiteral('Hello'), attribute: 'label="Hello"' },
    {
      label: 'a string containing a double quote',
      value: t.stringLiteral('She said "hi"'),
      attribute: `label='She said "hi"'`,
    },
    { label: 'a number', value: t.numericLiteral(3), attribute: ':label="3"' },
    { label: 'true', value: t.booleanLiteral(true), attribute: 'label' },
    { label: 'false', value: t.booleanLiteral(false), attribute: ':label="false"' },
    { label: 'null', value: t.nullLiteral(), attribute: ':label="null"' },
  ])('renders $label inline', ({ value, attribute }) => {
    expect(renderSfcSnippet({ componentName: 'C', args: [prop('label', value)] })).toBe(
      `<template>\n  <C ${attribute} />\n</template>`
    );
  });

  it('hoists a value that needs script scope', () => {
    const value = t.objectExpression([
      t.objectProperty(t.identifier('tone'), t.stringLiteral('neutral')),
    ]);

    expect(renderSfcSnippet({ componentName: 'C', args: [prop('options', value, 'hoist')] }))
      .toBe(`<script lang="ts" setup>
const options = {
    tone: "neutral"
};
</script>

<template>
  <C :options="options" />
</template>`);
  });

  it('hoists a string that both quote styles cannot delimit', () => {
    const value = t.stringLiteral(`She said "hi" and it's fine`);

    expect(renderSfcSnippet({ componentName: 'C', args: [prop('label', value)] })).toContain(
      ':label="label"'
    );
  });

  it('declares hoisted bindings in the order their attributes appear', () => {
    const snippet = renderSfcSnippet({
      componentName: 'MyComponent',
      args: [
        prop('aria-label', t.objectExpression([]), 'hoist'),
        prop('ariaLabel', t.arrayExpression([]), 'hoist'),
        prop('default', t.objectExpression([]), 'hoist'),
        prop('ref', t.objectExpression([]), 'hoist'),
        {
          name: 'model-value',
          value: t.stringLiteral('value'),
          role: 'model',
          plan: { kind: 'inline' },
        },
      ],
    });

    expect(snippet).toBe(`<script lang="ts" setup>
import { ref } from "vue";

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
    const snippet = renderSfcSnippet({
      componentName: 'C',
      args: [
        { name: 'header', value: t.stringLiteral('Title'), role: 'slot', plan: { kind: 'inline' } },
        { name: 'default', value: t.stringLiteral('Body'), role: 'slot', plan: { kind: 'inline' } },
      ],
    });

    expect(snippet).toBe(
      `<template>\n  <C> Body\n\n<template #header>Title</template> </C>\n</template>`
    );
  });

  it('interpolates a hoisted slot value', () => {
    const snippet = renderSfcSnippet({
      componentName: 'C',
      args: [
        {
          name: 'default',
          value: t.arrayExpression([t.stringLiteral('a')]),
          role: 'slot',
          plan: { kind: 'hoist' },
        },
      ],
    });

    expect(snippet).toContain('{{ _default }}');
  });

  it('hoists a listener and renders it as a Vue event binding', () => {
    const snippet = renderSfcSnippet({
      componentName: 'C',
      args: [
        {
          name: 'onSubmit',
          eventName: 'submit',
          value: t.arrowFunctionExpression([], t.nullLiteral()),
          role: 'event',
          plan: { kind: 'hoist' },
        },
      ],
    });

    expect(snippet).toBe(`<script lang="ts" setup>
const onSubmit = () => null;
</script>

<template>
  <C @submit="onSubmit" />
</template>`);
  });

  it('sorts event attributes after prop attributes', () => {
    const snippet = renderSfcSnippet({
      componentName: 'C',
      args: [
        {
          name: 'onSubmit',
          eventName: 'submit',
          value: t.arrowFunctionExpression([], t.nullLiteral()),
          role: 'event',
          plan: { kind: 'hoist' },
        },
        prop('label', t.stringLiteral('Send')),
      ],
    });

    expect(snippet).toContain('<C label="Send" @submit="onSubmit" />');
  });
});
