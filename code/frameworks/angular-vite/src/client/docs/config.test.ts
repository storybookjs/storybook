import { afterEach, describe, expect, it, vi } from 'vitest';

import { SNIPPET_TEMPLATE_KIND } from '../../story-snippet-template.ts';

const configWithFeatures = async (features: Record<string, boolean> | undefined) => {
  vi.stubGlobal('FEATURES', features);
  vi.resetModules();
  const { parameters, decorators } = await import('./config.ts');
  return {
    language: parameters.docs.source.language,
    renderSnippetTemplate: parameters.docs.source.renderSnippetTemplate,
    decorators,
  };
};

const featureOffCases: [string, Record<string, boolean> | undefined][] = [
  ['the feature is off', { experimentalDocgenServer: false }],
  ['no features are set', undefined],
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('docs source parameters', () => {
  it('labels the snippet TypeScript when the docgen server produces it', async () => {
    expect((await configWithFeatures({ experimentalDocgenServer: true })).language).toBe('ts');
  });

  it.each(featureOffCases)('labels the runtime template HTML when %s', async (_name, features) => {
    expect((await configWithFeatures(features)).language).toBe('html');
  });
});

// The renderer reaches the Code panel and the Source block through this exact parameter path;
// core reads the same string. Nothing else holds the two spellings together.
describe('docs.source.renderSnippetTemplate', () => {
  it('rebuilds a snippet this framework wrote', async () => {
    const { renderSnippetTemplate } = await configWithFeatures({ experimentalDocgenServer: true });

    expect(
      renderSnippetTemplate(
        {
          kind: SNIPPET_TEMPLATE_KIND,
          template: '<sb-button\n    [label]="{{label}}"\n/>',
          componentName: 'ButtonComponent',
          standalone: true,
          outputs: [],
        },
        { label: 'Save' }
      )
    ).toContain(`<sb-button [label]="'Save'" />`);
  });

  it('declines a payload another framework or an older build wrote', async () => {
    const { renderSnippetTemplate } = await configWithFeatures({ experimentalDocgenServer: true });

    expect(renderSnippetTemplate({ kind: 'vue-sfc' }, { label: 'Save' })).toBeUndefined();
  });
});

describe('docs decorators', () => {
  it('drops the runtime source decorator when the docgen server produces snippets', async () => {
    expect((await configWithFeatures({ experimentalDocgenServer: true })).decorators).toEqual([]);
  });

  it.each(featureOffCases)(
    'keeps the runtime source decorator when %s',
    async (_name, features) => {
      const { decorators } = await configWithFeatures(features);
      const { sourceDecorator } = await import('./sourceDecorator.ts');

      expect(decorators).toEqual([sourceDecorator]);
    }
  );
});
