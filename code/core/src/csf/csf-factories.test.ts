import { expectTypeOf, test } from 'vitest';

import type { Story } from './csf-factories';
import { definePreview, definePreviewAddon } from './csf-factories';
import type { Renderer } from './story';

interface Addon1Types {
  parameters: { foo?: { value: string } };
}

const addon = definePreviewAddon<Addon1Types>({});

interface Addon2Types {
  parameters: { bar?: { value: string } };
}

const addon2 = definePreviewAddon<Addon2Types>({});

const preview = definePreview({ addons: [addon, addon2] });

const meta = preview.meta({});

test('addon parameters are inferred', () => {
  const MyStory = meta.story({
    parameters: {
      foo: {
        // @ts-expect-error It should be a string
        value: 1,
      },
      bar: {
        // @ts-expect-error It should be a string
        value: 1,
      },
    },
  });

  expectTypeOf(MyStory).toEqualTypeOf<Story<Renderer & Addon1Types & Addon2Types>>();
});
