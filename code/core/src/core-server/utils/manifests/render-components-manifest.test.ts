import { describe, expect, it } from 'vitest';

import type { ComponentsManifestForRenderer } from './render-components-manifest.ts';
import { renderComponentsManifest } from './render-components-manifest.ts';

type RendererComponent = ComponentsManifestForRenderer['components'][string];

const component = (overrides: Partial<RendererComponent> = {}): RendererComponent => ({
  id: 'component',
  name: 'Component',
  path: './Component.tsx',
  jsDocTags: {},
  stories: [],
  ...overrides,
});

describe('renderComponentsManifest deep-link anchors', () => {
  it('anchors each card by its component-map key (the components.json key), not the entry id', () => {
    const html = renderComponentsManifest({
      v: 1,
      components: {
        'example-button': component({ id: 'legacy-internal-id', name: 'Button' }),
      },
    });

    // Tooling deep-links `components.html#<key>` where <key> is the components.json object key,
    // so the anchor must be the map key even when the entry's own `id` differs from it.
    expect(html).toContain('id="example-button"');
    expect(html).not.toContain('id="legacy-internal-id"');
  });

  it('emits the anchor id only once for an errored component rendered in both the grid and its error group', () => {
    const html = renderComponentsManifest({
      v: 1,
      components: {
        'example-button': component({ id: 'example-button', name: 'Button' }),
        'broken-input': component({
          id: 'broken-input',
          name: 'Input',
          error: { name: 'TypeError', message: 'boom' },
        }),
      },
    });

    // Sanity: an errored component is duplicated into a separate error-group section, so the same
    // card is in the DOM twice — the case that would produce a duplicate id if anchored naively.
    expect(html).toContain('API error groups');

    // The deep-link anchor must stay unique: only the main-grid card carries it.
    const anchorCount = (html.match(/id="broken-input"/g) ?? []).length;
    expect(anchorCount).toBe(1);
    // The healthy component still gets its own anchor.
    expect(html).toContain('id="example-button"');
  });
});

describe('renderComponentsManifest component API panel', () => {
  it('folds out the apiDescription markdown for a component that carries no React docgen', () => {
    const html = renderComponentsManifest({
      v: 1,
      components: {
        'color-picker': component({
          id: 'color-picker',
          name: 'ColorPickerComponent',
          apiDescription:
            '## Inputs\n\n```\nexport type ColorPickerComponentInputs = {\n  color?: string;\n}\n```',
        }),
      },
      meta: { docgen: 'angular-component-meta', durationMs: 0 },
    });

    expect(html).toContain('API description');
    expect(html).toContain('export type ColorPickerComponentInputs');
    // Angular and Vue never set the React docgen blobs, so the props wording must not appear.
    expect(html).not.toContain('prop type');
  });

  it('reports an API error instead of an API description when extraction failed', () => {
    const html = renderComponentsManifest({
      v: 1,
      components: {
        broken: component({
          id: 'broken',
          name: 'Broken',
          error: { name: 'CompodocError', message: 'compodoc produced no metadata' },
        }),
      },
    });

    expect(html).toContain('API error');
    expect(html).toContain('compodoc produced no metadata');
    expect(html).not.toContain('API description');
  });

  it('states that a component has no API description rather than rendering nothing', () => {
    const html = renderComponentsManifest({
      v: 1,
      components: {
        bare: component({ id: 'bare', name: 'Bare' }),
      },
    });

    // Without this the "docgen found nothing" case is indistinguishable from "component binds nothing".
    expect(html).toContain('no API description');
  });

  it('surfaces components without an API description as a top-level filter', () => {
    const html = renderComponentsManifest({
      v: 1,
      components: {
        bare: component({ id: 'bare', name: 'Bare' }),
        documented: component({
          id: 'documented',
          name: 'Documented',
          apiDescription: '## Inputs',
        }),
      },
    });

    expect(html).toContain('1/2 without API description');
    expect(html).toContain('missing-api');
  });

  it('offers no such filter when every component describes its API', () => {
    const html = renderComponentsManifest({
      v: 1,
      components: {
        documented: component({ id: 'documented', apiDescription: '## Inputs' }),
        broken: component({ id: 'broken', error: { name: 'Boom', message: 'boom' } }),
      },
    });

    // An extraction failure is its own state and says what went wrong, so it must not be
    // counted as a component that merely has nothing to describe.
    expect(html).not.toContain('without API description');
  });

  it('keeps the React prop-type output untouched', () => {
    const html = renderComponentsManifest({
      v: 1,
      components: {
        button: component({
          id: 'button',
          name: 'Button',
          reactComponentMeta: {
            exportName: 'Button',
            filePath: '/repo/Button.tsx',
            description: '',
            props: {
              label: {
                name: 'label',
                description: 'The button label',
                required: true,
                type: { name: 'string' },
                defaultValue: null,
              },
            },
          },
        } as Partial<RendererComponent>),
      },
    });

    expect(html).toContain('1 prop type');
    expect(html).toContain('label: string');
    expect(html).not.toContain('API description');
  });
});

describe('renderComponentsManifest snippet warnings', () => {
  const storyWithWarning = {
    id: 'storydocs-local-component--primary',
    name: 'Primary',
    snippet: '<sb-local-component [heading]="\'Declared here\'"></sb-local-component>',
    warning:
      'LocalComponent is declared in the story file, so the snippet references it without importing it.',
  };

  it('flags a story whose snippet is an incomplete example and shows why', () => {
    const html = renderComponentsManifest({
      v: 1,
      components: {
        'local-component': component({ stories: [storyWithWarning] }),
      },
    });

    expect(html).toContain('incomplete example');
    expect(html).toContain('so the snippet references it without importing it');
  });

  it('surfaces incomplete snippets as a top-level filter so they can be found', () => {
    const html = renderComponentsManifest({
      v: 1,
      components: {
        'local-component': component({ stories: [storyWithWarning] }),
        clean: component({
          id: 'clean',
          stories: [{ id: 'clean--primary', name: 'Primary', snippet: '<sb-clean></sb-clean>' }],
        }),
      },
    });

    expect(html).toContain('1/2 incomplete snippets');
    expect(html).toContain('has-story-warning');
  });

  it('says nothing about incompleteness when no story carries a warning', () => {
    const html = renderComponentsManifest({
      v: 1,
      components: {
        clean: component({
          stories: [{ id: 'clean--primary', name: 'Primary', snippet: '<sb-clean></sb-clean>' }],
        }),
      },
    });

    expect(html).not.toContain('incomplete example');
    expect(html).not.toContain('incomplete snippets');
  });
});
