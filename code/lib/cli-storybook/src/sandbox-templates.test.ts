import { describe, expect, it } from 'vitest';

import {
  baseTemplates,
  docgenServerTemplates,
  enablesDocgenServer,
  type Template,
} from './sandbox-templates.ts';

describe('docgenServerTemplates', () => {
  it('includes supported default-on templates that record component manifests', () => {
    expect(docgenServerTemplates()).toEqual([
      'vue3-vite/default-ts',
      'svelte-vite/default-ts',
      'angular-vite/default-ts',
      'lit-vite/default-ts',
    ]);
  });

  it('excludes manifest templates whose framework does not support server docgen', () => {
    const html: Template = baseTemplates['html-vite/default-ts'];

    expect(
      enablesDocgenServer('unsupported', {
        ...html,
        modifications: {
          ...html.modifications,
          mainConfig: { features: { componentsManifest: true } },
        },
      })
    ).toBe(false);
  });

  it('includes React templates that record component manifests', () => {
    const react = baseTemplates['react-vite/default-ts'];

    expect(
      enablesDocgenServer('react', {
        ...react,
        modifications: {
          ...react.modifications,
          mainConfig: { features: { componentsManifest: true } },
        },
      })
    ).toBe(true);
  });

  it('excludes supported manifest templates that explicitly disable server docgen', () => {
    const vue = baseTemplates['vue3-vite/default-ts'];

    expect(
      enablesDocgenServer('disabled', {
        ...vue,
        modifications: {
          ...vue.modifications,
          mainConfig: { features: { componentsManifest: true, docgenServer: false } },
        },
      })
    ).toBe(false);
  });
});

describe('React prerelease sandboxes', () => {
  it('pins React and React DOM to canary and types to latest', () => {
    const vite = baseTemplates['react-vite/prerelease-ts'];
    const webpack = baseTemplates['react-webpack/prerelease-ts'];

    expect(vite.modifications).toMatchObject({
      extraDependencies: ['react@canary', 'react-dom@canary'],
      extraDevDependencies: ['prop-types', '@types/react@latest', '@types/react-dom@latest'],
      resolutions: {
        '@types/react': 'npm:@types/react@latest',
        '@types/react-dom': 'npm:@types/react-dom@latest',
        react: 'npm:react@canary',
        'react-dom': 'npm:react-dom@canary',
      },
    });
    expect(vite.minAgeGateExemptions).toEqual(['react', 'react-dom', 'scheduler']);

    expect(webpack.script).toBe(
      'npx create-webpack5-react {{beforeDir}} --version-react="canary" --version-react-dom="canary"'
    );
    expect(webpack.modifications).toMatchObject({
      extraDevDependencies: ['prop-types', '@types/react@latest', '@types/react-dom@latest'],
      resolutions: {
        '@types/react': 'npm:@types/react@latest',
        '@types/react-dom': 'npm:@types/react-dom@latest',
      },
    });
    expect(webpack.minAgeGateExemptions).toEqual(['react', 'react-dom', 'scheduler']);
  });
});
