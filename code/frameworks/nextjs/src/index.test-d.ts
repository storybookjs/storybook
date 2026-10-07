import type { ComponentType } from 'react';

import { describe, expectTypeOf, it } from 'vitest';

import { definePreview } from './index.ts';

type Props = { label: string; optional?: boolean; onAction: () => void };
declare const Button: ComponentType<Props>;

describe('definePreview without addons', () => {
  const preview = definePreview({});

  it('accepts story args matching the component props', () => {
    const meta = preview.meta({ component: Button, args: { label: 'Save', onAction: () => {} } });

    expectTypeOf(meta.story).toBeCallableWith({ args: { optional: false } });
    // @ts-expect-error optional must be boolean
    meta.story({ args: { optional: 'no' } });
  });

  it('requires props that meta does not provide', () => {
    const meta = preview.meta({ component: Button, args: { label: 'Save' } });

    expectTypeOf(meta.story).toBeCallableWith({ args: { onAction: () => {} } });
    // @ts-expect-error onAction is required when meta does not provide it
    meta.story({ args: { optional: false } });
  });
});
