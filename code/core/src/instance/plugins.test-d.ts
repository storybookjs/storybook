import { expectTypeOf, test } from 'vitest';

import {
  type BuilderPlugin,
  defineAddon,
  defineBuilder,
  defineFramework,
  defineRenderer,
} from './plugins.ts';

declare const builder: BuilderPlugin;

test('resolves addon metadata without a caller-supplied kind', () => {
  const addon = defineAddon(() => ({ meta: { name: 'x' }, setup() {} }))();

  expectTypeOf(addon.meta.kind).toEqualTypeOf<'addon'>();
});

test('resolves builder, renderer, and framework kinds while preserving renderer types', () => {
  const resolvedBuilder = defineBuilder(() => ({ ...builder, meta: { name: 'builder' } }))();
  const renderer = defineRenderer<void, { story: string }>(() => ({
    meta: { name: 'renderer' },
    setup() {},
  }))();
  const framework = defineFramework<'framework', void, typeof renderer>(() => ({
    meta: { name: 'framework' },
    builder: resolvedBuilder,
    renderer,
    setup() {},
  }))();

  expectTypeOf(resolvedBuilder.meta.kind).toEqualTypeOf<'builder'>();
  expectTypeOf(renderer.meta.kind).toEqualTypeOf<'renderer'>();
  expectTypeOf(framework.meta.kind).toEqualTypeOf<'framework'>();
  expectTypeOf(framework.meta.name).toEqualTypeOf<'framework'>();
  expectTypeOf(framework.renderer.types).toEqualTypeOf<{ story: string } | undefined>();
});

test('rejects caller-supplied kinds in factory metadata', () => {
  defineAddon(() => ({
    // @ts-expect-error The helper owns the plugin kind.
    meta: { name: 'x', kind: 'addon' },
    setup() {},
  }));
  defineBuilder(() => ({
    ...builder,
    // @ts-expect-error The helper owns the plugin kind.
    meta: { name: 'builder', kind: 'builder' },
  }));
  defineRenderer(() => ({
    // @ts-expect-error The helper owns the plugin kind.
    meta: { name: 'renderer', kind: 'renderer' },
    setup() {},
  }));
  defineFramework(() => ({
    // @ts-expect-error The helper owns the plugin kind.
    meta: { name: 'framework', kind: 'framework' },
    builder,
    renderer: defineRenderer(() => ({ meta: { name: 'renderer' }, setup() {} }))(),
    setup() {},
  }));
});
