import { describe, expect, it } from 'vitest';

import { compareSnippet } from './snippets.ts';

describe('compareSnippet (angular)', () => {
  const angular = (baseline: string, candidate: string, args: Record<string, unknown> = {}) =>
    compareSnippet({ framework: 'angular', args, baseline, candidate });

  it('fails when a bound input disappears from the candidate', () => {
    const baseline =
      '<sb-decorator-io-basics [label]="\'Save\'" [count]="3" (clicked)="clicked($event)"></sb-decorator-io-basics>';
    const candidate =
      '<sb-decorator-io-basics [label]="\'Save\'" (clicked)="clicked($event)"></sb-decorator-io-basics>';
    expect(angular(baseline, candidate, { label: 'Save', count: 3 })).toEqual([
      expect.objectContaining({ arg: 'count', kind: 'lost-representation' }),
    ]);
  });

  it('passes on formatting-only differences: order, whitespace, value style', () => {
    const baseline =
      '<sb-decorator-io-basics [label]="\'Save\'" [count]="3" (clicked)="clicked($event)"></sb-decorator-io-basics>';
    const candidate =
      '<sb-decorator-io-basics  (clicked)="clicked($event)"   [count]="3"\n  [label]="\'Save\'"></sb-decorator-io-basics>';
    expect(angular(baseline, candidate, { label: 'Save', count: 3 })).toEqual([]);
  });

  it('fails when the auto-injected output binding is lost even though it is not a declared arg', () => {
    // Production runs the actions enhancer, so every declared output binds in every story's
    // snippet; losing one is a regression even when the story never declared the arg.
    const baseline =
      '<sb-decorator-io-basics [label]="\'Save\'" (clicked)="clicked($event)"></sb-decorator-io-basics>';
    const candidate = '<sb-decorator-io-basics [label]="\'Save\'"></sb-decorator-io-basics>';
    expect(angular(baseline, candidate, { label: 'Save' })).toEqual([
      expect.objectContaining({ arg: 'clicked', kind: 'lost-representation' }),
    ]);
  });

  it('passes when a declared arg is represented in neither side', () => {
    // The committed baselines drop function args; the baseline encodes the accepted delta.
    const baseline = '<sb-cmp [label]="\'Save\'"></sb-cmp>';
    const candidate = '<sb-cmp [label]="\'Save\'"></sb-cmp>';
    expect(angular(baseline, candidate, { label: 'Save', formatter: () => '' })).toEqual([]);
  });

  it('passes when the candidate represents a previously dropped arg', () => {
    const baseline = '<sb-cmp [label]="\'Save\'"></sb-cmp>';
    const candidate = '<sb-cmp [label]="\'Save\'" [formatter]="formatter"></sb-cmp>';
    expect(angular(baseline, candidate, { label: 'Save', formatter: () => '' })).toEqual([]);
  });

  it('matches binding names whole, not as substrings', () => {
    const baseline = '<sb-cmp [discount]="5"></sb-cmp>';
    const candidate = '<sb-cmp [discount]="5"></sb-cmp>';
    // "count" appears inside "discount" but is represented in neither snippet.
    expect(angular(baseline, candidate, { count: 3, discount: 5 })).toEqual([]);
  });

  it('does not read mangled selector attributes as representations', () => {
    // buildTemplate mangles attribute selectors to bare attributes: button[sb-harness-action]
    // renders as <button sb-harness-action ...>. Only [x]="..." and (y)="..." count.
    const baseline = '<button sb-harness-action [emphasis]="true"></button>';
    const candidate = '<button sb-harness-action [emphasis]="true"></button>';
    expect(angular(baseline, candidate, { emphasis: true })).toEqual([]);
  });

  it('does not read binding-shaped text inside attribute values as representations', () => {
    const baseline = '<sb-cmp [count]="3"></sb-cmp>';
    const candidate = '<sb-cmp data-example=\'[count]="not a binding"\'></sb-cmp>';
    expect(angular(baseline, candidate, { count: 3 })).toEqual([
      expect.objectContaining({ arg: 'count', kind: 'lost-representation' }),
    ]);
  });

  it('accepts single quotes and spaces around = as formatting-only', () => {
    const baseline = '<sb-cmp [count]="3" (clicked)="clicked($event)"></sb-cmp>';
    const candidate = "<sb-cmp [count] = '3' (clicked)='clicked($event)'></sb-cmp>";
    expect(angular(baseline, candidate, { count: 3 })).toEqual([]);
  });
});

describe('compareSnippet (vue3)', () => {
  const vue = (baseline: string, candidate: string, args: Record<string, unknown> = {}) =>
    compareSnippet({ framework: 'vue3', args, baseline, candidate });

  it('fails when a bound prop disappears from the candidate', () => {
    const baseline = '<template>\n  <Counter :count="2" label="Basic" />\n</template>';
    const candidate = '<template>\n  <Counter label="Basic" />\n</template>';
    expect(vue(baseline, candidate, { count: 2, label: 'Basic' })).toEqual([
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
    expect(
      vue(baseline, candidate, {
        config: { theme: 'dark' },
        label: 'Formatted',
        tags: ['alpha', 'beta'],
      })
    ).toEqual([]);
  });

  it('recognizes bare boolean attributes', () => {
    const baseline = '<template>\n  <Toggle checked />\n</template>';
    const candidate = '<template>\n  <Toggle />\n</template>';
    expect(vue(baseline, candidate, { checked: true })).toEqual([
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
    expect(vue(baseline, baseline, { checked: true, modelValue: 'typed text' })).toEqual([]);
    expect(vue(baseline, lost, { checked: true, modelValue: 'typed text' })).toEqual([
      expect.objectContaining({ arg: 'modelValue', kind: 'lost-representation' }),
    ]);
  });

  it('maps v-model:name to the named arg', () => {
    const baseline = '<template>\n  <Field v-model:query="query" />\n</template>';
    const candidate = '<template>\n  <Field /></template>';
    expect(vue(baseline, candidate, { query: 'x' })).toEqual([
      expect.objectContaining({ arg: 'query', kind: 'lost-representation' }),
    ]);
  });

  it('recognizes named slot templates', () => {
    const baseline =
      '<template>\n  <SlotsShowcase heading="Scoped"> <template #item="{ entry, index }"><em>{{ index }}</em></template> </SlotsShowcase>\n</template>';
    const candidate = '<template>\n  <SlotsShowcase heading="Scoped"></SlotsShowcase>\n</template>';
    expect(vue(baseline, candidate, { heading: 'Scoped', item: 'slot' })).toEqual([
      expect.objectContaining({ arg: 'item', kind: 'lost-representation' }),
    ]);
  });

  it('maps default-slot child content to the default arg', () => {
    const baseline =
      '<template>\n  <SlotsShowcase heading="Plain"> Plain text content </SlotsShowcase>\n</template>';
    const candidate = '<template>\n  <SlotsShowcase heading="Plain"></SlotsShowcase>\n</template>';
    expect(vue(baseline, candidate, { heading: 'Plain', default: 'Plain text content' })).toEqual([
      expect.objectContaining({ arg: 'default', kind: 'lost-representation' }),
    ]);
  });

  it('does not count named slot templates as default child content', () => {
    const namedOnly =
      '<template>\n  <SlotsShowcase heading="Scoped"> <template #item="{ entry }">x</template> </SlotsShowcase>\n</template>';
    // If the inner template counted as default content, the candidate would fail on "default".
    const candidate =
      '<template>\n  <SlotsShowcase heading="Scoped"><template #item="{ entry }">y</template></SlotsShowcase>\n</template>';
    expect(vue(namedOnly, candidate, { heading: 'Scoped', item: 'slot' })).toEqual([]);
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
    const violations = vue(baseline, candidate, { heading: 'Structured' });
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
    expect(vue(baseline, candidate, { config: { count: 1 }, count: 2 })).toEqual([
      expect.objectContaining({ arg: 'count', kind: 'lost-representation' }),
    ]);
  });

  it('keeps scanning past a single-quoted value containing a closing angle bracket', () => {
    const baseline = '<template>\n  <Widget :condition="a > b" label="kept" />\n</template>';
    const candidate = "<template>\n  <Widget :condition='a > b' label='kept' />\n</template>";
    expect(vue(baseline, candidate, { condition: false, label: 'kept' })).toEqual([]);
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
    expect(vue(baseline, candidate, { enabled: { deep: true }, label: 'x' })).toEqual([]);
  });
});
