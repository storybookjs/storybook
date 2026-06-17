import { mkdir, writeFile } from 'node:fs/promises';

import { selectComponentEntriesByComponentId } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { Manifests, Presets } from 'storybook/internal/types';

import { join } from 'pathe';
import type { Polka } from 'polka';
import invariant from 'tiny-invariant';

import { getService } from '../../../shared/open-service/server.ts';
import type { DocgenService } from '../../../shared/open-service/services/docgen/definition.ts';
import type { StoryDocsService } from '../../../shared/open-service/services/story-docs/definition.ts';
import { Tag } from '../../../shared/constants/tags.ts';
import type { ComponentsManifest } from '../../../types/modules/core-common.ts';
import type { DocgenPayload } from '../../../shared/open-service/services/docgen/types.ts';
import type { StoryDocsPayload } from '../../../shared/open-service/services/story-docs/types.ts';
import {
  buildComponentsRefManifest,
  type ComponentManifestWithStoryDocs,
  loadDocgenPayloadsFromDisk,
  loadStoryDocsPayloadsFromDisk,
  mergeManifestPayloads,
  toComponentManifestIndexEntries,
} from './components-ref-manifest.ts';
import {
  type ComponentsManifestForRenderer,
  type DocsManifest,
  renderComponentsManifest,
} from './render-components-manifest.ts';

/**
 * Wraps merged docgen + story-docs payloads in a {@link ComponentsManifest} shell for the HTML
 * debugger.
 */
function buildComponentsManifest(
  components: Record<string, ComponentManifestWithStoryDocs>,
  meta: ComponentsManifest['meta']
): ComponentsManifestForRenderer {
  return {
    v: 1,
    components,
    meta,
  };
}

function mergeServicePayloads(
  docgenPayloads: Record<string, DocgenPayload>,
  storyDocsPayloads: Record<string, StoryDocsPayload>,
  componentIds: string[]
): Record<string, ComponentManifestWithStoryDocs> {
  return Object.fromEntries(
    componentIds.flatMap((id) => {
      const docgen = docgenPayloads[id];
      if (!docgen) {
        return [];
      }
      return [[id, mergeManifestPayloads(docgen, storyDocsPayloads[id])] as const];
    })
  );
}

/** Narrows an unknown manifest value to the docs manifest shape used by the HTML debugger. */
function isDocsManifest(manifest: unknown): manifest is DocsManifest {
  return typeof manifest === 'object' && manifest !== null && 'docs' in manifest;
}

/**
 * Returns the story index entries tagged with `manifest`.
 *
 * Computed once per operation and threaded into {@link getManifests} and
 * {@link getManifestComponentIds} so a single write/render does not re-walk the index.
 */
async function getManifestEntries(presets: Presets) {
  const generator = await presets.apply('storyIndexGenerator');
  invariant(generator, 'storyIndexGenerator must be configured');
  const index = await generator.getIndex();
  return Object.values(index.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );
}

type ManifestEntries = Awaited<ReturnType<typeof getManifestEntries>>;

/**
 * Returns component ids for the given manifest-tagged entries.
 *
 * Uses the same component-id selection rules as docgen extraction and the legacy React manifest
 * generator.
 */
function getManifestComponentIds(manifestEntries: ManifestEntries) {
  return Array.from(selectComponentEntriesByComponentId(manifestEntries).keys());
}

/** Loads all manifests from the `experimental_manifests` preset for the given manifest entries. */
async function getManifests(
  presets: Presets,
  manifestEntries: ManifestEntries,
  { watch }: { watch?: boolean } = {}
) {
  return (
    (await presets.apply<Manifests>('experimental_manifests', undefined, {
      manifestEntries,
      watch,
    })) ?? {}
  );
}

/**
 * Resolves the docgen `meta` for the components HTML debugger.
 *
 * `meta.docgen` (the docgen engine id) is supplied by the renderer via `experimental_manifests`;
 * core does not infer it. `durationMs` is how long collecting the docgen payloads took.
 */
function resolveDocgenMeta(manifests: Manifests, durationMs: number): ComponentsManifest['meta'] {
  const presetMeta = manifests.components?.meta;
  invariant(
    presetMeta?.docgen,
    'experimental_manifests must supply components.meta.docgen when experimentalDocgenServer is enabled'
  );

  return { docgen: presetMeta.docgen, durationMs };
}

/**
 * Renders the components HTML debugger from the live docgen service (dev only).
 *
 * Loads all docgen payloads and filters to the given manifest-tagged component ids. The static build
 * renders from the on-disk snapshots instead (see {@link writeDocgenServerManifests}) so it does not
 * re-extract docgen.
 */
async function renderComponentsHtmlFromService(
  manifests: Manifests,
  manifestComponentIds: string[],
  docsManifest?: DocsManifest
) {
  const docgenService = getService<DocgenService>('core/docgen');
  const storyDocsService = getService<StoryDocsService>('core/story-docs');
  const startTime = performance.now();

  const [allDocgenPayloads, allStoryDocsPayloads] = await Promise.all([
    docgenService.queries.getDocgenForAllComponents.loaded(),
    storyDocsService.queries.getStoryDocsForAllComponents.loaded(),
  ]);

  const durationMs = Math.round(performance.now() - startTime);
  const components = mergeServicePayloads(
    allDocgenPayloads,
    allStoryDocsPayloads,
    manifestComponentIds
  );

  return renderComponentsManifest(
    buildComponentsManifest(components, resolveDocgenMeta(manifests, durationMs)),
    docsManifest
  );
}

/** Writes each manifest entry to `outputDir/manifests/<name>.json`. */
async function writeManifestJsonFiles(
  outputDir: string,
  manifests: Manifests,
  { skipComponents = false }: { skipComponents?: boolean } = {}
) {
  await Promise.all(
    Object.entries(manifests)
      .filter(([name]) => !skipComponents || name !== 'components')
      .map(([name, content]) =>
        writeFile(join(outputDir, 'manifests', `${name}.json`), JSON.stringify(content))
      )
  );
}

/**
 * Static build path when `features.experimentalDocgenServer` is enabled.
 *
 * Writes a ref-based `components.json`, other manifests from `experimental_manifests`, and
 * `components.html` rendered from the docgen service.
 */
async function writeDocgenServerManifests(
  outputDir: string,
  manifests: Manifests,
  manifestComponentIds: string[],
  docsManifest?: DocsManifest
) {
  const hasOtherManifests = Object.keys(manifests).some((name) => name !== 'components');
  const shouldWriteHtml = manifestComponentIds.length > 0 || !!docsManifest;

  if (!hasOtherManifests && !shouldWriteHtml) {
    return;
  }

  const manifestsDir = join(outputDir, 'manifests');
  await mkdir(manifestsDir, { recursive: true });

  // Read docgen once from the snapshots written by writeOpenServiceStaticFiles. The same payloads
  // back both components.json and the HTML debugger, so the build never re-extracts from the service.
  const startTime = performance.now();
  const [docgenPayloads, storyDocsPayloads] = await Promise.all([
    loadDocgenPayloadsFromDisk(outputDir, manifestComponentIds),
    loadStoryDocsPayloadsFromDisk(outputDir, manifestComponentIds),
  ]);
  const durationMs = Math.round(performance.now() - startTime);
  const mergedComponents = mergeServicePayloads(
    docgenPayloads,
    storyDocsPayloads,
    manifestComponentIds
  );

  if (manifestComponentIds.length > 0) {
    await writeFile(
      join(manifestsDir, 'components.json'),
      JSON.stringify(
        buildComponentsRefManifest(
          toComponentManifestIndexEntries(manifestComponentIds, docgenPayloads, storyDocsPayloads),
          manifests.components?.meta
        )
      )
    );
  }

  await writeManifestJsonFiles(outputDir, manifests, { skipComponents: true });

  if (shouldWriteHtml) {
    await writeFile(
      join(manifestsDir, 'components.html'),
      renderComponentsManifest(
        buildComponentsManifest(mergedComponents, resolveDocgenMeta(manifests, durationMs)),
        docsManifest
      )
    );
  }
}

/**
 * Static build path for the legacy inline components manifest from `experimental_manifests`.
 */
async function writeLegacyManifests(
  outputDir: string,
  manifests: Manifests,
  docsManifest?: DocsManifest
) {
  if (Object.keys(manifests).length === 0) {
    return;
  }

  const manifestsDir = join(outputDir, 'manifests');
  await mkdir(manifestsDir, { recursive: true });
  await writeManifestJsonFiles(outputDir, manifests);

  if ('components' in manifests || 'docs' in manifests) {
    await writeFile(
      join(manifestsDir, 'components.html'),
      renderComponentsManifest(manifests.components, docsManifest)
    );
  }
}

/** Writes manifest JSON (and HTML when applicable) to `outputDir/manifests/`. */
export async function writeManifests(outputDir: string, presets: Presets) {
  try {
    const features = await presets.apply('features');
    const manifestEntries = await getManifestEntries(presets);
    const manifests = await getManifests(presets, manifestEntries);
    const docsManifest = isDocsManifest(manifests.docs) ? manifests.docs : undefined;

    if (features.experimentalDocgenServer) {
      await writeDocgenServerManifests(
        outputDir,
        manifests,
        getManifestComponentIds(manifestEntries),
        docsManifest
      );
      return;
    }

    await writeLegacyManifests(outputDir, manifests, docsManifest);
  } catch (e) {
    logger.error('Failed to generate manifests');
    logger.error(e instanceof Error ? e : String(e));
  }
}

/**
 * Registers dev-server routes for manifest JSON and the components HTML debugger.
 *
 * When `experimentalDocgenServer` is enabled, `components.json` is not served (404) and
 * `components.html` is rendered from the docgen service instead of the inline manifest.
 */
export function registerManifests({ app, presets }: { app: Polka; presets: Presets }) {
  let useDocgenServerPromise: Promise<boolean> | undefined;

  const isDocgenServerEnabled = () => {
    useDocgenServerPromise ??= presets
      .apply('features')
      .then((features) => features?.experimentalDocgenServer ?? false);
    return useDocgenServerPromise;
  };

  app.get('/manifests/:name.json', async (req, res) => {
    try {
      if ((await isDocgenServerEnabled()) && req.params.name === 'components') {
        res.statusCode = 404;
        res.end(
          `Manifest "${req.params.name}" is not available in dev when experimentalDocgenServer is enabled`
        );
        return;
      }

      const manifestEntries = await getManifestEntries(presets);
      const manifests = await getManifests(presets, manifestEntries, { watch: true });
      const manifest = manifests[req.params.name];

      if (manifest) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(manifest));
      } else {
        res.statusCode = 404;
        res.end(`Manifest "${req.params.name}" not found`);
      }
    } catch (e) {
      logger.error(e instanceof Error ? e : String(e));
      res.statusCode = 500;
      res.end(e instanceof Error ? e.toString() : String(e));
    }
  });

  app.get('/manifests/components.html', async (req, res) => {
    try {
      const manifestEntries = await getManifestEntries(presets);
      const manifests = await getManifests(presets, manifestEntries, { watch: true });
      const docsManifest = isDocsManifest(manifests.docs) ? manifests.docs : undefined;

      if (await isDocgenServerEnabled()) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(
          await renderComponentsHtmlFromService(
            manifests,
            getManifestComponentIds(manifestEntries),
            docsManifest
          )
        );
        return;
      }

      const componentsManifest = manifests.components;

      if (!componentsManifest && !docsManifest) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<pre>No components or docs manifest configured.</pre>`);
        return;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(renderComponentsManifest(componentsManifest, docsManifest));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<pre>${e instanceof Error ? e.stack : String(e)}</pre>`);
    }
  });
}
