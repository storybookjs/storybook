import { describe, expect, it } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { experimental_docgenProvider } from './preset.ts';

const optionsWith = (
  features: Record<string, unknown>,
  frameworkOptions: Record<string, unknown> = {}
) =>
  ({
    configDir: '/workspace/.storybook',
    presets: {
      apply: async (key: string) => {
        if (key === 'features') {
          return features;
        }
        if (key === 'framework') {
          return { name: '@storybook/angular-vite', options: frameworkOptions };
        }
        if (key === 'frameworkOptions') {
          return frameworkOptions;
        }
        return undefined;
      },
    },
  }) as unknown as Options;

describe('experimental_docgenProvider', () => {
  it('contributes no descriptor when the docgen server flag is off', async () => {
    expect(await experimental_docgenProvider([], optionsWith({}))).toEqual([]);
  });

  it('contributes the descriptor even when the user opted out with `compodoc: false`', async () => {
    // `storybook init` and the angular-to-angular-vite automigration write this option on the
    // user's behalf. It switches the Compodoc run, which does not happen under the flag at all.
    const result = await experimental_docgenProvider(
      [],
      optionsWith({ experimentalDocgenServer: true }, { compodoc: false })
    );

    expect(result).toHaveLength(1);
  });

  it('contributes the worker descriptor when the flag is on and Compodoc is not opted out', async () => {
    const result = await experimental_docgenProvider(
      [],
      optionsWith({ experimentalDocgenServer: true })
    );

    expect(result).toHaveLength(1);
    expect(result[0].moduleSpecifier).toContain('docgen-worker');
    expect(result[0].options).toEqual({ propsTable: 'api' });
  });

  it('hands the worker the mode the deprecated feature maps onto', async () => {
    const result = await experimental_docgenProvider(
      [],
      optionsWith({ experimentalDocgenServer: true, angularFilterNonInputControls: true })
    );

    expect(result[0].options).toEqual({ propsTable: 'inputs' });
  });

  it('hands the worker the framework option, which outranks the deprecated feature', async () => {
    const result = await experimental_docgenProvider(
      [],
      optionsWith(
        { experimentalDocgenServer: true, angularFilterNonInputControls: true },
        { propsTable: 'all' }
      )
    );

    expect(result[0].options).toEqual({ propsTable: 'all' });
  });
});
