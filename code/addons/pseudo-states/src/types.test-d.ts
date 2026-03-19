import { describe, expectTypeOf, it } from 'vitest';

import { definePreview } from 'storybook/internal/csf';

import pseudoAddon from '.';
import '../../../renderers/react/src/typings';

describe('addon parameters are injected to csf factory', () => {
  // Define preview with pseudo addon
  const preview = definePreview({ addons: [pseudoAddon()] });

  it('with invalid value', () => {
    const meta = preview.meta({
      parameters: {
        pseudo: {
          // @ts-expect-error focus should be bool/string
          focus: 2,
        },
      },
    });
    expectTypeOf(meta.input.parameters!.pseudo).not.toExtend<{ focus: number }>();
  });

  it('with invalid key', () => {
    const meta = preview.meta({
      parameters: {
        pseudo: {
          // @ts-expect-error this pseudo state doesn't exist
          madeUpKey: true,
        },
      },
    });
    expectTypeOf(meta.input.parameters!.pseudo).not.toExtend<{ madeUpKey: boolean }>();
  });

  it('with valid config', () => {
    const meta = preview.meta({
      parameters: {
        pseudo: {
          rootSelector: 'body',
          focus: true,
        },
      },
    });
    expectTypeOf(meta.input.parameters!.pseudo!).toExtend<{ focus: boolean }>();
  });
});
