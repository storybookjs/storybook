import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { BASELINE_PATH } from './baseline-path.ts';

const gapTest = BASELINE_PATH === 'legacy' ? test.fails : test;

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const BASELINES = {
  unionArgTypes: 'props-union-enum/argtypes.snapshot',
  basicTypesArgTypes: 'props-basic-types/argtypes.snapshot',
  genericArgTypes: 'props-generic/argtypes.snapshot',
  intersectionArgTypes: 'type-intersection/argtypes.snapshot',
  destructuredArgTypes: 'define-props-destructured/argtypes.snapshot',
  jsdocArgTypes: 'jsdoc-tags/argtypes.snapshot',
  pickArgTypes: 'cross-file-composed-utility/argtypes.snapshot',
  vModelArgTypes: 'v-model/argtypes.snapshot',
  vModelSnippet: 'v-model/snippet-VModelBinding.snapshot',
  bigintSnippet: 'props-basic-types/snippet-UnrepresentableArgs.snapshot',
  runtimePropsArgTypes: 'cross-file-runtime-props/argtypes.snapshot',
  spreadPropsArgTypes: 'cross-file-props-spread/argtypes.snapshot',
  multiConstructorArgTypes: 'runtime-multi-constructor/argtypes.snapshot',
  propTypeCastArgTypes: 'runtime-proptype-cast/argtypes.snapshot',
  slotLiteralBindingsArgTypes: 'define-slots-literal-bindings/argtypes.snapshot',
  scopedSlotBindingsArgTypes: 'slots/argtypes.snapshot',
  wholeIntersectionArgTypes: 'type-intersection-whole/argtypes.snapshot',
  unionAliasArgTypes: 'cross-file-union-alias/argtypes.snapshot',
  collisionSnippet: 'prop-slot-name-collision/snippet-IconPropAsWritten.snapshot',
} as const;

const baseline = (key: keyof typeof BASELINES) =>
  readFileSync(join(fixturesDir, BASELINES[key]), 'utf-8');

// Guards the markers below: a missing snapshot would throw inside a test.fails body and
// silently masquerade as the expected failure.
test('every baseline referenced by a red marker exists', () => {
  for (const relativePath of Object.values(BASELINES)) {
    expect(existsSync(join(fixturesDir, relativePath)), relativePath).toBe(true);
  }
});

describe('legacy argTypes gaps (red until a re-recorded baseline closes them)', () => {
  gapTest('literal-string unions are recorded as an enum sbType', () => {
    // Legacy: sbType `union` whose elements are `other` values with embedded quotes.
    expect(baseline('unionArgTypes')).toContain('"name": "enum"');
  });

  gapTest('array-typed props are recorded with a structured array sbType', () => {
    // Legacy: the shared convert() helper stringifies to `Array([object Object])`. The
    // negative assertions keep a fixed discriminator from passing over the same
    // stringified value.
    expect(baseline('basicTypesArgTypes')).toContain('"name": "array"');
    expect(baseline('basicTypesArgTypes')).not.toContain('Array([object Object])');
    expect(baseline('genericArgTypes')).toContain('"name": "array"');
    expect(baseline('genericArgTypes')).not.toContain('Array([object Object])');
  });

  gapTest('intersection-typed props are recorded with a structured intersection sbType', () => {
    // Legacy: `intersection([object Object],[object Object])` from the same convert() bug.
    expect(baseline('intersectionArgTypes')).toContain('"name": "intersection"');
    expect(baseline('intersectionArgTypes')).not.toContain('intersection([object Object]');
  });

  gapTest('reactive-props-destructure defaults are recorded', () => {
    // Legacy: only the withDefaults() call pattern is extracted; the inline destructured
    // default is invisible, so `size` records `"defaultValue": undefined`.
    expect(baseline('destructuredArgTypes')).toMatch(/"defaultValue": \{[^}]*medium/);
  });

  gapTest('prop JSDoc tags are recorded in table.jsDocTags', () => {
    // Legacy: vue-docgen-api splits tags into a separate `tags` object that the
    // description-parsing pipeline never reads, so jsDocTags stays undefined.
    // Both props must carry their own tags: `label` declares @deprecated/@since and
    // `title` declares @default, on different parse paths, so a per-prop partial fix
    // must not close this marker.
    expect(baseline('jsdocArgTypes')).toMatch(/"jsDocTags": [[{]/);
    expect(baseline('jsdocArgTypes')).toContain('deprecated');
    expect(baseline('jsdocArgTypes')).toContain('since');
  });

  gapTest('Pick-composed props are resolved', () => {
    // Legacy: the whole `props` section is absent, so the recorded argTypes are `{}`.
    expect(baseline('pickArgTypes')).toContain('"label"');
  });

  gapTest('defineModel named models surface as prop and update event', () => {
    // Legacy: `defineModel('checked')` is entirely invisible - no prop, no event.
    expect(baseline('vModelArgTypes')).toContain('"checked"');
    expect(baseline('vModelArgTypes')).toContain('"update:checked"');
  });

  gapTest('runtime props imported from another file are resolved', () => {
    // #11774 / #12331 - legacy: vue-docgen-api never follows the import, argTypes are {}.
    expect(baseline('runtimePropsArgTypes')).toContain('"label"');
    expect(baseline('runtimePropsArgTypes')).toContain('"count"');
  });

  gapTest('props spread from an imported function call are resolved', () => {
    // #22187 - legacy: only the inline literal prop is extracted.
    expect(baseline('spreadPropsArgTypes')).toContain('"label"');
    expect(baseline('spreadPropsArgTypes')).toContain('"optional"');
  });

  gapTest('multi-constructor runtime types are recorded as a structured union', () => {
    // #19394 - legacy: flat "string|number" display string with sbType "other". The
    // structured SBUnionType carries its members in an array-valued `value`.
    expect(baseline('multiConstructorArgTypes')).toContain('"name": "union"');
    expect(baseline('multiConstructorArgTypes')).toMatch(/"value": \[/);
  });

  gapTest('literal unions behind PropType casts keep their options', () => {
    // #20593 - legacy: `String as PropType<'primary' | 'secondary'>` collapses to "string".
    // The options must reach the sbType Controls reads (an enum), not just summary text.
    expect(baseline('propTypeCastArgTypes')).toContain('secondary');
    expect(baseline('propTypeCastArgTypes')).toContain('"name": "enum"');
  });

  gapTest('defineSlots literal binding types are extracted', () => {
    // #24270 - legacy: bindings record `unknown` instead of the literal types. Both
    // binding params must resolve; a partial fix on one alone must not close this marker.
    expect(baseline('slotLiteralBindingsArgTypes')).toContain('currentColor');
    expect(baseline('slotLiteralBindingsArgTypes')).toMatch(/size: (?!unknown)/);
    expect(baseline('slotLiteralBindingsArgTypes')).toMatch(/fill: (?!unknown)/);
  });

  gapTest('scoped-slot binding types are extracted', () => {
    // #26465 - legacy: `{ entry: unknown; index: unknown }` despite a typed defineSlots.
    // A bare toContain('entry') would already match the slot description prose; the
    // lookaheads require each binding to be present AND resolved to a non-unknown type.
    expect(baseline('scopedSlotBindingsArgTypes')).toMatch(/entry: (?!unknown)/);
    expect(baseline('scopedSlotBindingsArgTypes')).toMatch(/index: (?!unknown)/);
  });

  gapTest('an intersection as the whole props type argument is resolved', () => {
    // #30045 - legacy: no props at all, the Props panel is empty.
    expect(baseline('wholeIntersectionArgTypes')).toContain('"id"');
    expect(baseline('wholeIntersectionArgTypes')).toContain('"size"');
  });

  gapTest('imported literal-union aliases are unfolded to their options', () => {
    // #29354 - legacy: name-only "ButtonVariant" with sbType "other". The options must
    // reach the sbType Controls reads (an enum), not just summary text.
    expect(baseline('unionAliasArgTypes')).toContain('danger');
    expect(baseline('unionAliasArgTypes')).toContain('"name": "enum"');
  });
});

describe('legacy snippet gaps (red until a re-recorded baseline closes them)', () => {
  gapTest('named models render as a v-model:checked binding', () => {
    // Legacy: docgen blindness to defineModel yields a bare `checked` attribute.
    expect(baseline('vModelSnippet')).toContain('v-model:checked=');
  });

  gapTest('bigint args beyond MAX_SAFE_INTEGER round-trip exactly', () => {
    // Legacy: `BigInt(9007199254740993)` embeds bare digits that are truncated as a JS
    // number before the BigInt is constructed, yielding a different value than the story.
    expect(baseline('bigintSnippet')).toMatch(
      /9007199254740993n|BigInt\(["']9007199254740993["']\)/
    );
  });

  gapTest('an arg matching both a prop and a slot renders as the prop attribute', () => {
    // #12850 / #23470 - legacy: the icon PROP value is routed into slot content.
    expect(baseline('collisionSnippet')).toContain('icon="pi pi-check"');
  });
});
