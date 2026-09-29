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
      'vue3-vite/docgen-server-ts',
      'angular-vite/docgen-server-ts',
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
    const vue = baseTemplates['vue3-vite/docgen-server-ts'];

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
