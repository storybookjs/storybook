import { expectTypeOf, it } from 'vitest';

import { definePreviewAddon, type FeatureTypes } from 'storybook/internal/csf';
import {
  defineAddon,
  defineFramework,
  type FrameworkTypes,
  type MainTypes,
} from 'storybook/internal/instance';

import a11y from '@storybook/addon-a11y/node';
import type { A11yTypes } from '@storybook/addon-a11y';
import type { ReactPreview, ReactTypes } from '@storybook/react';

import { definePreview } from './index.ts';
import { defineMain, reactVite } from './node/index.ts';

it('preserves the framework and native addon tuple in main', () => {
  const main = defineMain({ stories: [], framework: reactVite(), addons: [a11y()] });

  expectTypeOf(main.framework).toEqualTypeOf<ReturnType<typeof reactVite>>();
  expectTypeOf(main.addons).toEqualTypeOf<[ReturnType<typeof a11y>]>();
  expectTypeOf<MainTypes<typeof main>>().toExtend<ReactTypes & A11yTypes & FeatureTypes>();
  expectTypeOf<ReactTypes & A11yTypes & FeatureTypes>().toExtend<MainTypes<typeof main>>();
});

it('types preview and CSF4 stories from main without repeating addons', () => {
  const main = defineMain({ stories: [], framework: reactVite(), addons: [a11y()] });
  const preview = definePreview.for<typeof main>()({
    parameters: { a11y: { test: 'error' } },
    initialGlobals: { backgrounds: { value: 'light' } },
  });
  const meta = preview.meta({});
  meta.story({
    parameters: { a11y: { test: 'todo' } },
    globals: { backgrounds: { value: 'dark' } },
  });
  meta.story({
    parameters: {
      a11y: {
        // @ts-expect-error The accessibility addon defines the allowed test modes.
        test: 'invalid',
      },
    },
  });

  expectTypeOf<NonNullable<typeof preview.input.parameters>['a11y']>().toEqualTypeOf<
    A11yTypes['parameters']['a11y']
  >();
});

it('does not contribute accessibility parameters when the addon is absent', () => {
  const main = defineMain({ stories: [], framework: reactVite() });
  const preview = definePreview.for<typeof main>()({});
  const meta = preview.meta({});

  // @ts-expect-error Accessibility parameters require the accessibility addon in main.
  meta.story({ parameters: { a11y: { test: 'error' } } });

  // @ts-expect-error Other parameters cannot enable an unlisted addon.
  meta.story({ parameters: { layout: 'centered', a11y: { test: 'error' } } });

  const untyped = definePreviewAddon({});
  const withUntyped = definePreview
    .for<typeof main>()({ addons: [untyped] })
    .meta({});
  // @ts-expect-error An untyped preview addon contributes no parameters.
  withUntyped.story({ parameters: { layout: 'centered', a11y: { test: 'error' } } });
});

it('keeps React and preview addon inference without a main type', () => {
  const preview = definePreview({});
  expectTypeOf(preview).toEqualTypeOf<ReactPreview<ReactTypes & { csf4: true }>>();
  preview.meta({}).story({ parameters: { custom: true } });

  const addon = definePreviewAddon<{ parameters: { custom?: { enabled: boolean } } }>({});
  const typed = definePreview({ addons: [addon] });
  expectTypeOf<NonNullable<typeof typed.input.parameters>['custom']>().toEqualTypeOf<
    { enabled: boolean } | undefined
  >();
});

it('combines framework defaults and native addons while ignoring legacy entries', () => {
  const addon = defineAddon<void, { args: { enabled: boolean } }>(() => ({
    meta: { name: 'custom' },
    setup() {},
  }));
  const base = reactVite();
  const framework = defineFramework<
    'custom-framework',
    void,
    typeof base.renderer,
    [ReturnType<typeof addon>]
  >(() => ({
    ...base,
    meta: { name: 'custom-framework' },
    addons: [addon()],
  }))();
  const untyped = defineAddon(() => ({ meta: { name: 'untyped' }, setup() {} }));
  const main = defineMain({
    stories: [],
    framework,
    addons: ['@storybook/addon-docs', untyped(), a11y()],
  });

  expectTypeOf<FrameworkTypes<typeof framework>>().toEqualTypeOf<
    ReactTypes & { args: { enabled: boolean } }
  >();
  expectTypeOf<MainTypes<typeof main>>().toExtend<
    ReactTypes & { args: { enabled: boolean } } & A11yTypes & FeatureTypes
  >();
});

it('adds preview-only types after choosing the main configuration', () => {
  const main = defineMain({ stories: [], framework: reactVite(), addons: [a11y()] });
  const addon = definePreviewAddon<{ parameters: { custom?: { enabled: boolean } } }>({});
  const preview = definePreview.for<typeof main>()({ addons: [addon] });

  expectTypeOf<NonNullable<typeof preview.input.parameters>['custom']>().toEqualTypeOf<
    { enabled: boolean } | undefined
  >();
});

it('keeps component args and native addon args in main-typed stories', () => {
  const addon = defineAddon<void, { args: { enabled: boolean } }>(() => ({
    meta: { name: 'custom-args' },
    setup() {},
  }));
  const main = defineMain({ stories: [], framework: reactVite(), addons: [addon()] });
  const preview = definePreview.for<typeof main>()({});
  const meta = preview.meta({ component: (_props: { label: string }) => null });

  meta.story({ args: { label: 'Primary', enabled: true } });
  // @ts-expect-error The main addon requires its arg.
  meta.story({ args: { label: 'Primary' } });
  // @ts-expect-error Component args retain their declared types.
  meta.story({ args: { label: 123, enabled: true } });
});

it('accepts explicitly declared custom preview parameters without widening addon values', () => {
  const main = defineMain({ stories: [], framework: reactVite(), addons: [a11y()] });
  const preview = definePreview.for<typeof main, { parameters: Record<string, unknown> }>()({});
  const meta = preview.meta({});

  meta.story({ parameters: { custom: true, a11y: { test: 'error' } } });
  // @ts-expect-error Custom parameters do not widen the accessibility addon's declared values.
  meta.story({ parameters: { custom: true, a11y: { test: 'invalid' } } });
});
