import { describe, expect, it } from 'vitest';

import { compareSnippet } from './snippets.ts';

describe('compareSnippet (angular)', () => {
  const angular = (baseline: string, candidate: string) =>
    compareSnippet({ framework: 'angular', baseline, candidate });

  it('fails when a bound input disappears from the candidate', () => {
    const baseline =
      '<sb-decorator-io-basics [label]="\'Save\'" [count]="3" (clicked)="clicked($event)"></sb-decorator-io-basics>';
    const candidate =
      '<sb-decorator-io-basics [label]="\'Save\'" (clicked)="clicked($event)"></sb-decorator-io-basics>';
    expect(angular(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'count', kind: 'lost-representation' }),
    ]);
  });

  it('passes on formatting-only differences: order, whitespace, value style', () => {
    const baseline =
      '<sb-decorator-io-basics [label]="\'Save\'" [count]="3" (clicked)="clicked($event)"></sb-decorator-io-basics>';
    const candidate =
      '<sb-decorator-io-basics  (clicked)="clicked($event)"   [count]="3"\n  [label]="\'Save\'"></sb-decorator-io-basics>';
    expect(angular(baseline, candidate)).toEqual([]);
  });

  it('fails when the auto-injected output binding is lost even though it is not a declared arg', () => {
    // Production runs the actions enhancer, so every declared output binds in every story's
    // snippet; losing one is a regression even when the story never declared the arg.
    const baseline =
      '<sb-decorator-io-basics [label]="\'Save\'" (clicked)="clicked($event)"></sb-decorator-io-basics>';
    const candidate = '<sb-decorator-io-basics [label]="\'Save\'"></sb-decorator-io-basics>';
    expect(angular(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'clicked', kind: 'lost-representation' }),
    ]);
  });

  it('passes when the candidate represents a binding the baseline dropped', () => {
    // The committed baselines drop function args; the baseline encodes the accepted delta.
    const baseline = '<sb-cmp [label]="\'Save\'"></sb-cmp>';
    const candidate = '<sb-cmp [label]="\'Save\'" [formatter]="formatter"></sb-cmp>';
    expect(angular(baseline, candidate)).toEqual([]);
  });

  it('matches binding names whole, not as substrings', () => {
    const baseline = '<sb-cmp [discount]="5"></sb-cmp>';
    const candidate = '<sb-cmp [count]="5"></sb-cmp>';
    // "count" sits inside "discount", but it is a different binding.
    expect(angular(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'discount', kind: 'lost-representation' }),
    ]);
  });

  it('does not read mangled selector attributes as representations', () => {
    // buildTemplate mangles attribute selectors to bare attributes: button[sb-harness-action]
    // renders as <button sb-harness-action ...>. Only [x]="..." and (y)="..." count.
    const baseline = '<button sb-harness-action [emphasis]="true"></button>';
    const candidate = '<button [emphasis]="true"></button>';
    expect(angular(baseline, candidate)).toEqual([]);
  });

  it('does not read binding-shaped text inside attribute values as representations', () => {
    const baseline = '<sb-cmp [count]="3"></sb-cmp>';
    const candidate = '<sb-cmp data-example=\'[count]="not a binding"\'></sb-cmp>';
    expect(angular(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'count', kind: 'lost-representation' }),
    ]);
  });

  it('accepts single quotes and spaces around = as formatting-only', () => {
    const baseline = '<sb-cmp [count]="3" (clicked)="clicked($event)"></sb-cmp>';
    const candidate = "<sb-cmp [count] = '3' (clicked)='clicked($event)'></sb-cmp>";
    expect(angular(baseline, candidate)).toEqual([]);
  });

  it('reads a two-way binding as both its input and change-output names', () => {
    const banana = '<sb-cmp [(value)]="value"></sb-cmp>';
    const desugared = '<sb-cmp [value]="value" (valueChange)="valueChange($event)"></sb-cmp>';
    // The sugar and its expansion represent the same names, in both directions.
    expect(angular(banana, desugared)).toEqual([]);
    expect(angular(desugared, banana)).toEqual([]);
    expect(angular(banana, '<sb-cmp></sb-cmp>')).toEqual([
      expect.objectContaining({ arg: 'value', kind: 'lost-representation' }),
      expect.objectContaining({ arg: 'valueChange', kind: 'lost-representation' }),
    ]);
  });
});

describe('compareSnippet (vue3)', () => {
  const vue = (baseline: string, candidate: string) =>
    compareSnippet({ framework: 'vue3', baseline, candidate });

  it('fails when a bound prop disappears from the candidate', () => {
    const baseline = '<template>\n  <Counter :count="2" label="Basic" />\n</template>';
    const candidate = '<template>\n  <Counter label="Basic" />\n</template>';
    expect(vue(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'count', kind: 'lost-representation' }),
    ]);
  });

  it('passes on formatting-only differences including inlining a hoisted const', () => {
    const baseline = [
      '<script lang="ts" setup>',
      'const tags = ["alpha","beta"];',
      '</script>',
      '',
      '<template>',
      '  <PropsBasicTypes :config="{ theme: \'dark\' }" label="Formatted" :tags="tags" />',
      '</template>',
    ].join('\n');
    const candidate = [
      '<template>',
      '  <PropsBasicTypes',
      "    :tags=\"['alpha', 'beta']\"",
      '    :config="{ theme: \'dark\' }"',
      '    label="Formatted"',
      '  />',
      '</template>',
    ].join('\n');
    expect(vue(baseline, candidate)).toEqual([]);
  });

  it('recognizes bare boolean attributes', () => {
    const baseline = '<template>\n  <Toggle checked />\n</template>';
    const candidate = '<template>\n  <Toggle />\n</template>';
    expect(vue(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'checked', kind: 'lost-representation' }),
    ]);
  });

  it('maps v-model to the modelValue arg', () => {
    const baseline = [
      '<script lang="ts" setup>',
      'import { ref } from "vue";',
      '',
      'const modelValue = ref("typed text");',
      '</script>',
      '',
      '<template>',
      '  <VModelInput checked v-model="modelValue" />',
      '</template>',
    ].join('\n');
    const lost = '<template>\n  <VModelInput checked />\n</template>';
    expect(vue(baseline, baseline)).toEqual([]);
    expect(vue(baseline, lost)).toEqual([
      expect.objectContaining({ arg: 'modelValue', kind: 'lost-representation' }),
    ]);
  });

  it('maps v-model:name to the named arg', () => {
    const baseline = '<template>\n  <Field v-model:query="query" />\n</template>';
    const candidate = '<template>\n  <Field /></template>';
    expect(vue(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'query', kind: 'lost-representation' }),
    ]);
  });

  it('ignores directive modifiers, which never change the name being bound', () => {
    const plain =
      '<template>\n  <Field v-model="q" v-model:page="p" :count="1" @save="onSave" />\n</template>';
    const modified =
      '<template>\n  <Field v-model.trim="q" v-model:page.number="p" :count.camel="1" @save.once="onSave" />\n</template>';
    expect(vue(plain, modified)).toEqual([]);
    expect(vue(modified, plain)).toEqual([]);
  });

  it('reads v-bind: long form as the bare prop name', () => {
    const shorthand = '<template>\n  <Field :count="1" />\n</template>';
    const longform = '<template>\n  <Field v-bind:count="1" />\n</template>';
    expect(vue(shorthand, longform)).toEqual([]);
    expect(vue(longform, shorthand)).toEqual([]);
  });

  it('recognizes named slot templates', () => {
    const baseline =
      '<template>\n  <SlotsShowcase heading="Scoped"> <template #item="{ entry, index }"><em>{{ index }}</em></template> </SlotsShowcase>\n</template>';
    const candidate = '<template>\n  <SlotsShowcase heading="Scoped"></SlotsShowcase>\n</template>';
    expect(vue(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'item', kind: 'lost-representation' }),
    ]);
  });

  it('maps default-slot child content to the default arg', () => {
    const baseline =
      '<template>\n  <SlotsShowcase heading="Plain"> Plain text content </SlotsShowcase>\n</template>';
    const candidate = '<template>\n  <SlotsShowcase heading="Plain"></SlotsShowcase>\n</template>';
    expect(vue(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'default', kind: 'lost-representation' }),
    ]);
  });

  it('reads the v-slot: long form as a named slot', () => {
    const shorthand =
      '<template>\n  <SlotsShowcase><template #item="{ entry }">x</template></SlotsShowcase>\n</template>';
    const longform =
      '<template>\n  <SlotsShowcase><template v-slot:item="{ entry }">x</template></SlotsShowcase>\n</template>';
    expect(vue(shorthand, longform)).toEqual([]);
    expect(vue(longform, shorthand)).toEqual([]);
  });

  it('does not count a nested named slot as default child content', () => {
    // A slot whose content is a component with slots of its own nests the templates; matching the
    // first </template> would leave the outer closing tag behind and read as default content.
    const nested =
      '<template>\n  <SlotsShowcase><template #item><Child><template #icon>x</template></Child></template></SlotsShowcase>\n</template>';
    const flattened =
      '<template>\n  <SlotsShowcase><template #item>y</template><template #icon>z</template></SlotsShowcase>\n</template>';
    expect(vue(nested, flattened)).toEqual([]);
  });

  it('does not count named slot templates as default child content', () => {
    const namedOnly =
      '<template>\n  <SlotsShowcase heading="Scoped"> <template #item="{ entry }">x</template> </SlotsShowcase>\n</template>';
    // Emptying the element loses "item" and nothing else: if the template's own markup counted as
    // default content, "default" would be reported lost too.
    const emptied = '<template>\n  <SlotsShowcase heading="Scoped"></SlotsShowcase>\n</template>';
    expect(vue(namedOnly, emptied)).toEqual([
      expect.objectContaining({ arg: 'item', kind: 'lost-representation' }),
    ]);
  });

  it('does not count a self-closing named slot as default child content', () => {
    const selfClosing =
      '<template>\n  <SlotsShowcase><template #item /></SlotsShowcase>\n</template>';
    const emptied = '<template>\n  <SlotsShowcase></SlotsShowcase>\n</template>';
    expect(vue(selfClosing, emptied)).toEqual([
      expect.objectContaining({ arg: 'item', kind: 'lost-representation' }),
    ]);
  });

  it('keeps default content sitting behind template-shaped text in a descendant attribute', () => {
    // An unclosed `<template #x>` inside a value is text, not a slot block; swallowing the rest
    // would hide a genuinely dropped default slot.
    const baseline =
      '<template>\n  <Widget><span title="<template #x>">real default text</span></Widget>\n</template>';
    const emptied = '<template>\n  <Widget></Widget>\n</template>';
    expect(vue(baseline, emptied)).toEqual([
      expect.objectContaining({ arg: 'default', kind: 'lost-representation' }),
      expect.objectContaining({ arg: 'x', kind: 'lost-representation' }),
    ]);
  });

  it('detects both default content and named slots when they coexist', () => {
    const baseline = [
      '<template>',
      '  <SlotsShowcase heading="Structured"> <p class="body">Body content</p>',
      '',
      '<template #header><strong>Header content</strong></template> </SlotsShowcase>',
      '</template>',
    ].join('\n');
    const candidate =
      '<template>\n  <SlotsShowcase heading="Structured"></SlotsShowcase>\n</template>';
    const violations = vue(baseline, candidate);
    expect(violations).toEqual([
      expect.objectContaining({ arg: 'default', kind: 'lost-representation' }),
      expect.objectContaining({ arg: 'header', kind: 'lost-representation' }),
    ]);
  });

  it('does not read words inside single-quoted values as attribute names', () => {
    // A single-quoted value must be skipped like a double-quoted one; its content would
    // otherwise fabricate representations and mask a genuinely dropped binding.
    const baseline = '<template>\n  <Widget :config="{ count: 1 }" :count="2" />\n</template>';
    const candidate = "<template>\n  <Widget :config='{ count }' />\n</template>";
    expect(vue(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'count', kind: 'lost-representation' }),
    ]);
  });

  it('keeps scanning past a single-quoted value containing a closing angle bracket', () => {
    const baseline = '<template>\n  <Widget :condition="a > b" label="kept" />\n</template>';
    const candidate = "<template>\n  <Widget :condition='a > b' label='kept' />\n</template>";
    expect(vue(baseline, candidate)).toEqual([]);
  });

  it('reports an unparsable candidate once instead of as a pile of lost bindings', () => {
    const baseline = '<template>\n  <Widget :count="1" label="x" />\n</template>';
    expect(vue(baseline, 'nothing rendered')).toEqual([
      expect.objectContaining({ kind: 'unparsable-candidate' }),
    ]);
  });

  it('reads event bindings as their bare event names', () => {
    const baseline = '<template>\n  <Form label="x" @save="onSave" />\n</template>';
    const longform = '<template>\n  <Form label="x" v-on:save="onSave" />\n</template>';
    expect(vue(baseline, longform)).toEqual([]);
    expect(vue(baseline, '<template>\n  <Form label="x" />\n</template>')).toEqual([
      expect.objectContaining({ arg: 'save', kind: 'lost-representation' }),
    ]);
  });

  it('ignores hoisted const names in the script block', () => {
    // A hoisted const colliding with a declared prop must not count as representation.
    const baseline = [
      '<script lang="ts" setup>',
      'const enabled = { deep: true };',
      '</script>',
      '',
      '<template>',
      '  <Widget label="x" />',
      '</template>',
    ].join('\n');
    const candidate = '<template>\n  <Widget label="x" />\n</template>';
    expect(vue(baseline, candidate)).toEqual([]);
  });
});
