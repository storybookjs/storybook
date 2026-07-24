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
    expect(html).toContain('Prop type error groups');

    // The deep-link anchor must stay unique: only the main-grid card carries it.
    const anchorCount = (html.match(/id="broken-input"/g) ?? []).length;
    expect(anchorCount).toBe(1);
    // The healthy component still gets its own anchor.
    expect(html).toContain('id="example-button"');
  });
});
