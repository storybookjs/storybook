import { describe, expect, it } from 'vitest';

import {
  allTemplates,
  baseTemplates,
  daily,
  docgenServerTemplates,
  enablesDocgenServer,
  normal,
  type Template,
  type TemplateKey,
} from './sandbox-templates.ts';

describe('docgenServerTemplates', () => {
  it('includes supported default-on templates that record component manifests', () => {
    expect(docgenServerTemplates()).toEqual([
      'vue3-vite/default-ts',
      'svelte-vite/default-ts',
      'angular-vite/default-ts',
      'lit-vite/default-ts',
      'react-vite/typescript-7-ts',
      'angular-vite/typescript-7-ts',
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
      extraDevDependencies: [
        'prop-types',
        '@types/react@latest',
        '@types/react-dom@latest',
        'typescript@^6',
      ],
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

describe('React bench sandboxes', () => {
  it('pin typescript to ^6 (their modifications replace the base template)', () => {
    for (const key of [
      'bench/react-vite-default-ts',
      'bench/react-vite-default-ts-nodocs',
      'bench/react-vite-default-ts-test-build',
    ] as const) {
      expect(allTemplates[key].modifications).toMatchObject({
        extraDevDependencies: ['typescript@^6'],
      });
    }
  });
});

describe('TypeScript 7.1 sandboxes', () => {
  const keys = ['react-vite/typescript-7-ts', 'angular-vite/typescript-7-ts'] as const;

  it('run daily only, without Chromatic', () => {
    for (const key of keys) {
      expect(daily).toContain(key);
      expect(normal).not.toContain(key);
      expect(allTemplates[key].skipTasks).toContain('chromatic');
    }
  });

  it('install TypeScript 7.1 as typescript for React', () => {
    expect(allTemplates['react-vite/typescript-7-ts'].modifications).toMatchObject({
      extraDevDependencies: expect.arrayContaining(['typescript@7.1.0-beta']),
      mainConfig: { features: { componentsManifest: true, docgenServer: true } },
    });
  });

  it('install TypeScript 7.1 beside TypeScript 6 for Angular, and read types with it', () => {
    expect(allTemplates['angular-vite/typescript-7-ts'].modifications).toMatchObject({
      extraDependencies: expect.arrayContaining([
        'typescript@^6',
        '@typescript/native@npm:typescript@7.1.0-beta',
      ]),
      mainConfig: {
        features: { componentsManifest: true, docgenServer: true },
        typescript: { docgenSpecifier: '@typescript/native' },
      },
    });
  });
});

describe('docgenBaselinesFrom', () => {
  it('names a docgen server template that records its own baselines', () => {
    const withServer = docgenServerTemplates();
    for (const [key, template] of Object.entries(allTemplates)) {
      const source = template.docgenBaselinesFrom;
      if (!source) {
        continue;
      }
      expect(withServer, key).toContain(key);
      expect(withServer, key).toContain(source);
      expect(allTemplates[source as TemplateKey].docgenBaselinesFrom, key).toBeUndefined();
    }
  });
});

describe('docgenBaselineComponents', () => {
  it('is set only on a docgen server template that records its own baselines', () => {
    const withServer = docgenServerTemplates();
    for (const [key, template] of Object.entries(allTemplates)) {
      if (!template.docgenBaselineComponents) {
        continue;
      }
      expect(withServer, key).toContain(key);
      expect(template.docgenBaselinesFrom, key).toBeUndefined();
    }
  });
});
