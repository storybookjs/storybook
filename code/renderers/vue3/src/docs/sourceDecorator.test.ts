import { expect, test } from 'vitest';
import { h } from 'vue';
import type { SourceCodeGeneratorContext } from './sourceDecorator';
import {
  generatePropsSourceCode,
  generateSlotSourceCode,
  generateSourceCode,
  getFunctionParamNames,
  parseDocgenInfo,
} from './sourceDecorator';

test('should generate source code for props', () => {
  const ctx: SourceCodeGeneratorContext = {
    scriptVariables: {},
    imports: {},
  };

  const code = generatePropsSourceCode(
    {
      a: 'foo',
      b: '"I am double quoted"',
      c: 42,
      d: true,
      e: false,
      f: [1, 2, 3],
      g: {
        g1: 'foo',
        g2: 42,
      },
      h: undefined,
      i: null,
      j: '',
      k: BigInt(9007199254740991),
      l: Symbol(),
      m: Symbol('foo'),
      modelValue: 'test-v-model',
      otherModelValue: 42,
      default: 'default slot',
      testSlot: 'test slot',
    },
    ['default', 'testSlot'],
    ['update:modelValue', 'update:otherModelValue'],
    ctx
  );

  expect(code).toBe(
    `a="foo" b='"I am double quoted"' :c="42" d :e="false" :f="f" :g="g" :k="BigInt(9007199254740991)" :l="Symbol()" :m="Symbol('foo')" v-model="modelValue" v-model:otherModelValue="otherModelValue"`
  );

  expect(ctx.scriptVariables).toStrictEqual({
    f: `[1,2,3]`,
    g: `{"g1":"foo","g2":42}`,
    modelValue: 'ref("test-v-model")',
    otherModelValue: 'ref(42)',
  });

  expect(Array.from(ctx.imports.vue.values())).toStrictEqual(['ref']);
});

test('should generate source code for slots', () => {
  // slot code generator should support primitive values (string, number etc.)
  // but also VNodes (e.g. created using h()) so custom Vue components can also be used
  // inside slots with proper generated code

  const slots = {
    default: 'default content',
    a: 'a content',
    b: 42,
    c: true,
    // single VNode without props
    d: h('div', 'd content'),
    // VNode with props and single child
    e: h('div', { style: 'color:red' }, 'e content'),
    // VNode with props and single child returned as getter
    f: h('div', { style: 'color:red' }, () => 'f content'),
    // VNode with multiple children
    g: h('div', { style: 'color:red' }, [
      'child 1',
      h('span', { style: 'color:green' }, 'child 2'),
    ]),
    // VNode multiple children but returned as getter
    h: h('div', { style: 'color:red' }, () => [
      'child 1',
      h('span', { style: 'color:green' }, 'child 2'),
    ]),
    // VNode with multiple and nested children
    i: h('div', { style: 'color:red' }, [
      'child 1',
      h('span', { style: 'color:green' }, ['nested child 1', h('p', 'nested child 2')]),
    ]),
    j: ['child 1', 'child 2'],
    k: null,
    l: { foo: 'bar' },
    m: BigInt(9007199254740991),
  };

  const expectedCode = `default content

<template #a>a content</template>

<template #b>42</template>

<template #c>true</template>

<template #d><div>d content</div></template>

<template #e><div style="color:red">e content</div></template>

<template #f><div style="color:red">f content</div></template>

<template #g><div style="color:red">child 1
<span style="color:green">child 2</span></div></template>

<template #h><div style="color:red">child 1
<span style="color:green">child 2</span></div></template>

<template #i><div style="color:red">child 1
<span style="color:green">nested child 1
<p>nested child 2</p></span></div></template>

<template #j>child 1
child 2</template>

<template #l>{"foo":"bar"}</template>

<template #m>{{ BigInt(9007199254740991) }}</template>`;

  let actualCode = generateSlotSourceCode(slots, Object.keys(slots), {
    scriptVariables: {},
    imports: {},
  });
  expect(actualCode).toBe(expectedCode);

  // should generate the same code if getters/functions are used to return the slot content
  const slotsWithGetters = Object.entries(slots).reduce<
    Record<string, () => (typeof slots)[keyof typeof slots]>
  >((obj, [slotName, value]) => {
    obj[slotName] = () => value;
    return obj;
  }, {});

  actualCode = generateSlotSourceCode(slotsWithGetters, Object.keys(slotsWithGetters), {
    scriptVariables: {},
    imports: {},
  });
  expect(actualCode).toBe(expectedCode);
});

test('should generate source code for slots with bindings', () => {
  type TestBindings = {
    foo: string;
    bar?: number;
  };

  const slots = {
    a: ({ foo, bar }: TestBindings) => `Slot with bindings ${foo} and ${bar}`,
    b: ({ foo }: TestBindings) => h('a', { href: foo, target: foo }, `Test link: ${foo}`),
  };

  const expectedCode = `<template #a="{ foo, bar }">Slot with bindings {{ foo }} and {{ bar }}</template>

<template #b="{ foo }"><a :href="foo" :target="foo">Test link: {{ foo }}</a></template>`;

  const actualCode = generateSlotSourceCode(slots, Object.keys(slots), {
    imports: {},
    scriptVariables: {},
  });
  expect(actualCode).toBe(expectedCode);
});

test('should generate source code with <script setup> block', () => {
  const actualCode = generateSourceCode({
    title: 'MyComponent',
    component: {
      __docgenInfo: {
        slots: [{ name: 'mySlot' }],
        events: [{ name: 'update:c' }],
      },
    },
    args: {
      a: 42,
      b: 'foo',
      c: [1, 2, 3],
      d: { bar: 'baz' },
      mySlot: () => h('div', { test: [1, 2], d: { nestedProp: 'foo' } }),
    },
  });

  expect(actualCode).toBe(`<script lang="ts" setup>
import { ref } from "vue";

const c = ref([1,2,3]);

const d = {"bar":"baz"};

const d1 = {"nestedProp":"foo"};

const test = [1,2];
</script>

<template>
  <MyComponent :a="42" b="foo" v-model:c="c" :d="d"> <template #mySlot><div :d="d1" :test="test" /></template> </MyComponent>
</template>`);
});

test.each([
  { __docgenInfo: 'invalid-value', slotNames: [] },
  { __docgenInfo: {}, slotNames: [] },
  { __docgenInfo: { slots: 'invalid-value' }, slotNames: [] },
  { __docgenInfo: { slots: ['invalid-value'] }, slotNames: [] },
  {
    __docgenInfo: { slots: [{ name: 'slot-1' }, { name: 'slot-2' }, { notName: 'slot-3' }] },
    slotNames: ['slot-1', 'slot-2'],
  },
])('should parse slots names from __docgenInfo', ({ __docgenInfo, slotNames }) => {
  const docgenInfo = parseDocgenInfo({ __docgenInfo });
  expect(docgenInfo.slotNames).toStrictEqual(slotNames);
});

test.each([
  { __docgenInfo: 'invalid-value', eventNames: [] },
  { __docgenInfo: {}, eventNames: [] },
  { __docgenInfo: { events: 'invalid-value' }, eventNames: [] },
  { __docgenInfo: { events: ['invalid-value'] }, eventNames: [] },
  {
    __docgenInfo: { events: [{ name: 'event-1' }, { name: 'event-2' }, { notName: 'event-3' }] },
    eventNames: ['event-1', 'event-2'],
  },
])('should parse event names from __docgenInfo', ({ __docgenInfo, eventNames }) => {
  const docgenInfo = parseDocgenInfo({ __docgenInfo });
  expect(docgenInfo.eventNames).toStrictEqual(eventNames);
});

test.each<{ fn: (...args: any[]) => unknown; expectedNames: string[] }>([
  { fn: () => ({}), expectedNames: [] },
  { fn: (a) => ({}), expectedNames: ['a'] },
  { fn: (a, b) => ({}), expectedNames: ['a', 'b'] },
  { fn: (a, b, { c }) => ({}), expectedNames: ['a', 'b', '{', 'c', '}'] },
  { fn: ({ a, b }) => ({}), expectedNames: ['{', 'a', 'b', '}'] },
  {
    fn: {
      // simulate minified function after running "storybook build"
      toString: () => '({a:foo,b:bar})=>({})',
    } as (...args: any[]) => unknown,
    expectedNames: ['{', 'a', 'b', '}'],
  },
])('should extract function parameter names', ({ fn, expectedNames }) => {
  const paramNames = getFunctionParamNames(fn);
  expect(paramNames).toStrictEqual(expectedNames);
});
