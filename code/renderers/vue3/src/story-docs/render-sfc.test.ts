import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';

import { renderSfcSnippet } from './render-sfc.ts';

describe('renderSfcSnippet', () => {
  it('allocates valid unique names for hoisted bindings', () => {
    const snippet = renderSfcSnippet({
      componentName: 'MyComponent',
      args: [
        { type: 'prop', name: 'aria-label', value: t.objectExpression([]) },
        { type: 'prop', name: 'ariaLabel', value: t.arrayExpression([]) },
        { type: 'prop', name: 'default', value: t.objectExpression([]) },
        { type: 'prop', name: 'ref', value: t.objectExpression([]) },
        { type: 'model', name: 'model-value', value: t.stringLiteral('value') },
      ],
    });

    expect(snippet).toBe(`<script lang="ts" setup>
import { ref } from "vue";

const ariaLabel = {};

const ariaLabel2 = [];

const _default = {};

const ref2 = {};

const modelValue = ref("value");
</script>

<template>
  <MyComponent :aria-label="ariaLabel" :ariaLabel="ariaLabel2" :default="_default" v-model:model-value="modelValue" :ref="ref2" />
</template>`);
  });
});
