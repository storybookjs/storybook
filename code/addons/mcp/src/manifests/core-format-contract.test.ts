/**
 * Contract test guarding the vendored manifest-assembly helpers against drift.
 *
 * `core-manifest.fixture.json` is trimmed verbatim from a real Storybook core
 * build (`storybook-static`). If core changes the `$ref` scheme or the on-disk
 * `services/` layout, these assertions fail — signalling that `vendored.ts` (and
 * `in-process-provider.ts`) must be re-synced with core.
 */
import { describe, it, expect } from 'vitest';
import fixture from './__fixtures__/core-manifest.fixture.json' with { type: 'json' };
import {
  DOCGEN_SERVICE_ID,
  MDX_SERVICE_ID,
  STORY_DOCS_SERVICE_ID,
  docgenManifestRef,
  mdxManifestRef,
  storyDocsManifestRef,
} from './vendored.ts';

const components = fixture.components.components as Record<string, any>;
const docs = fixture.docs.docs as Record<string, any>;

describe('vendored ref helpers match core build output', () => {
  it('reproduces every docgen and story-docs $ref in components.json', () => {
    for (const [id, entry] of Object.entries(components)) {
      if (entry.docgen) {
        expect(docgenManifestRef(id)).toBe(entry.docgen.$ref);
      }
      if (entry.stories) {
        expect(storyDocsManifestRef(id)).toBe(entry.stories.$ref);
      }
    }
  });

  it('reproduces attached-docs mdx $refs in components.json', () => {
    for (const [componentId, entry] of Object.entries(components)) {
      if (!entry.docs) {
        continue;
      }
      for (const [docId, row] of Object.entries(entry.docs as Record<string, any>)) {
        expect(mdxManifestRef(componentId, docId)).toBe(row.mdx.$ref);
      }
    }
  });

  it('reproduces unattached-docs mdx $refs in docs.json', () => {
    for (const [docId, entry] of Object.entries(docs)) {
      expect(mdxManifestRef(docId, docId)).toBe(entry.mdx.$ref);
    }
  });

  it('keeps service ids in lock-step with the on-disk services/ directory layout', () => {
    // The $ref paths point at services/<service-id>/<id>.json — the service ids
    // double as directory names, so a rename here would break path resolution.
    const sampleDocgenRef = (Object.values(components)[0] as any).docgen.$ref as string;
    expect(sampleDocgenRef).toContain(`services/${DOCGEN_SERVICE_ID}/`);

    const sampleStoryRef = (Object.values(components)[0] as any).stories.$ref as string;
    expect(sampleStoryRef).toContain(`services/${STORY_DOCS_SERVICE_ID}/`);

    const sampleMdxRef = (Object.values(docs)[0] as any).mdx.$ref as string;
    expect(sampleMdxRef).toContain(`services/${MDX_SERVICE_ID}/`);
  });
});
