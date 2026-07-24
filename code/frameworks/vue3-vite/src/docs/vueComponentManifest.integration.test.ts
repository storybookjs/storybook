import path from 'node:path';

import type { IndexEntry } from 'storybook/internal/types';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { manifests } from './vueComponentManifest.ts';

/**
 * End-to-end check for the Vue 3 manifest contribution: drives the real `experimental_manifests`
 * preset — no worker, no mocks — against the real template `.vue` component (MySlotComponent.vue) and
 * its CSF story file. Proves CSF → `.vue` resolution + `vue-component-meta` (Volar) extraction produce
 * a v0 row whose `apiMd` fragment keeps the scoped `default` slot under `## Slots`, never
 * `## Props`.
 *
 * The checker builds a real TypeScript program over the template dir, so these tests are slower than
 * unit tests (hence the raised timeout).
 */

// Template stories live under the vue3 renderer; use its directory as the generator working dir so
// the story's relative `importPath` resolves regardless of the real `process.cwd()`.
const TEMPLATE_DIR = path.resolve(
  __dirname,
  '../../../../renderers/vue3/template/stories_vue3-vite-default-ts'
);

const storyEntry = (importPath: string, id: string, title: string): IndexEntry =>
  ({
    type: 'story',
    subtype: 'story',
    importPath,
    id,
    title,
    name: 'Basic',
    tags: ['manifest'],
  }) as IndexEntry;

describe('vue3 components manifest (integration)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders an apiMd fragment with slots kept out of props', { timeout: 60_000 }, async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(TEMPLATE_DIR);

    const result = (await manifests({}, {
      manifestEntries: [
        storyEntry('./ScopedSlots.stories.ts', 'scopedslots--basic', 'ScopedSlots'),
      ],
      watch: false,
    } as any))!;

    expect(result.components?.v).toBe(0);
    expect(result.components?.meta?.docgen).toBe('vue-component-meta');

    const rows = Object.values(result.components?.components ?? {});
    expect(rows.length).toBe(1);
    const row = rows[0];

    expect(row.renderer).toBe('vue3');

    const apiMd = row.apiMd;
    expect(apiMd).toBeDefined();

    // Props extracted by vue-component-meta from `defineProps`, rendered as a `ts` `export type` block.
    expect(apiMd).toContain('## Props');
    expect(apiMd).toContain('export type Props = {');
    expect(apiMd).toContain('label');
    expect(apiMd).toContain('year');

    // The scoped default slot lands under Slots and NEVER inside Props.
    const slotsIndex = apiMd!.indexOf('## Slots');
    expect(slotsIndex).toBeGreaterThan(-1);
    const propsSection = apiMd!.slice(apiMd!.indexOf('## Props'), slotsIndex);
    expect(apiMd!.slice(slotsIndex)).toContain('export type Slots = {');
    expect(apiMd!.slice(slotsIndex)).toContain('default:');
    expect(propsSection).not.toContain('default');

    // Story snippets pulled from the CSF.
    expect(row.stories.length).toBeGreaterThan(0);
    expect(row.stories.some((s) => s.snippet)).toBe(true);
  });

  it(
    'exposes apiMd on the row served through the experimental_manifests contract',
    { timeout: 60_000 },
    async () => {
      vi.spyOn(process, 'cwd').mockReturnValue(TEMPLATE_DIR);

      // Mirrors how core's dev-server `getManifests` invokes the preset property:
      // `presets.apply('experimental_manifests', undefined, { manifestEntries, watch })`.
      const applyManifests = (
        _initial: undefined,
        options: { manifestEntries: IndexEntry[]; watch: boolean }
      ) => manifests({}, options as any);

      const served = (await applyManifests(undefined, {
        manifestEntries: [
          storyEntry('./ScopedSlots.stories.ts', 'scopedslots--basic', 'ScopedSlots'),
        ],
        watch: false,
      }))!;

      const row = Object.values(served.components?.components ?? {})[0];
      expect(row.renderer).toBe('vue3');
      expect(typeof row.apiMd).toBe('string');
      expect(row.apiMd).toContain('## Props');
    }
  );
});
