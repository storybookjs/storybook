import { mkdir, writeFile } from 'node:fs/promises';

import { selectComponentEntriesByComponentId } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { Manifests, Presets } from 'storybook/internal/types';

import { join } from 'pathe';
import type { Polka } from 'polka';
import invariant from 'tiny-invariant';

import { getService } from '../../../shared/open-service/server.ts';
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
  createDiskLoader,
  createDocsOnlyDocgenPayload,
  createServiceLoader,
  fullTransform,
  getAttachedDocsByComponent,
  injectAttachedDocsSummaries,
  loadMdxPayloadsFromServiceIfNeeded,
  resolveComponentDocs,
  resolveDocsManifestRefs,
  shallowSummaryTransform,
} from './mdx-ref-resolution.ts';
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

function isDocgenServerManifestMode(features: {
  experimentalDocgenServer?: boolean;
  componentsManifest?: boolean;
}): boolean {
  return features.experimentalDocgenServer === true && features.componentsManifest === true;
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

function withDocsOnlyComponents(
  components: Record<string, ComponentManifestWithStoryDocs>,
  manifestComponentIds: string[],
  docsByComponentId: Record<string, Record<string, unknown>>
): Record<string, ComponentManifestWithStoryDocs> {
  const next = { ...components };

  for (const id of manifestComponentIds) {
    if (!next[id] && docsByComponentId[id]) {
      next[id] = mergeManifestPayloads(createDocsOnlyDocgenPayload(id));
    }
  }

  return next;
}

/**
 * Renders the components HTML debugger from the live docgen, story-docs, and MDX services (dev
 * only).
 */
async function renderComponentsHtmlFromService(
  manifests: Manifests,
  manifestComponentIds: string[],
  docsManifest?: DocsManifest
) {
  const docgenService = getService('core/docgen');
  const storyDocsService = getService('core/story-docs');
  const startTime = performance.now();

  const [allDocgenPayloads, allStoryDocsPayloads, mdxPayloads] = await Promise.all([
    docgenService.queries.getDocgenForAllComponents.loaded(),
    storyDocsService.queries.getStoryDocsForAllComponents.loaded(),
    loadMdxPayloadsFromServiceIfNeeded(manifests, docsManifest),
  ]);

  const durationMs = Math.round(performance.now() - startTime);
  const docsByComponentId = getAttachedDocsByComponent(manifests.components);
  const components = withDocsOnlyComponents(
    mergeServicePayloads(allDocgenPayloads, allStoryDocsPayloads, manifestComponentIds),
    manifestComponentIds,
    docsByComponentId
  );

  const load = createServiceLoader(mdxPayloads);
  const [componentsWithDocs, resolvedDocsManifest] = await Promise.all([
    resolveComponentDocs(components, manifests, load, fullTransform),
    resolveDocsManifestRefs(docsManifest, load, fullTransform),
  ]);

  return renderComponentsManifest(
    buildComponentsManifest(componentsWithDocs, resolveDocgenMeta(manifests, durationMs)),
    resolvedDocsManifest
  );
}

/** Writes each manifest entry to `outputDir/manifests/<name>.json` (pretty-printed). */
async function writeManifestJsonFiles(
  outputDir: string,
  manifests: Manifests,
  { skipComponents = false }: { skipComponents?: boolean } = {}
) {
  await Promise.all(
    Object.entries(manifests)
      .filter(([name]) => !skipComponents || name !== 'components')
      .map(([name, content]) =>
        writeFile(join(outputDir, 'manifests', `${name}.json`), JSON.stringify(content, null, 2))
      )
  );
}

/**
 * Static build path when `features.experimentalDocgenServer` is enabled.
 *
 * Writes a ref-based `components.json` (with MDX summaries layered in from the snapshots), other
 * manifests from `experimental_manifests`, and `components.html` rendered from the docgen,
 * story-docs, and MDX service snapshots.
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

  const startTime = performance.now();
  const [docgenPayloads, storyDocsPayloads] = await Promise.all([
    loadDocgenPayloadsFromDisk(outputDir, manifestComponentIds),
    loadStoryDocsPayloadsFromDisk(outputDir, manifestComponentIds),
  ]);
  const durationMs = Math.round(performance.now() - startTime);
  const docsByComponentId = getAttachedDocsByComponent(manifests.components);
  const mergedComponents = withDocsOnlyComponents(
    mergeServicePayloads(docgenPayloads, storyDocsPayloads, manifestComponentIds),
    manifestComponentIds,
    docsByComponentId
  );

  const load = createDiskLoader(outputDir);

  const [attachedDocsWithSummaries, docsManifestWithSummaries] = await Promise.all([
    injectAttachedDocsSummaries(docsByComponentId, load),
    resolveDocsManifestRefs(docsManifest, load, shallowSummaryTransform),
  ]);

  if (manifestComponentIds.length > 0) {
    await writeFile(
      join(manifestsDir, 'components.json'),
      JSON.stringify(
        buildComponentsRefManifest(
          toComponentManifestIndexEntries(
            manifestComponentIds,
            docgenPayloads,
            storyDocsPayloads,
            attachedDocsWithSummaries
          ),
          manifests.components?.meta
        ),
        null,
        2
      )
    );
  }

  await writeManifestJsonFiles(
    outputDir,
    docsManifestWithSummaries ? { ...manifests, docs: docsManifestWithSummaries } : manifests,
    { skipComponents: true }
  );

  if (shouldWriteHtml) {
    const [componentsWithDocs, resolvedDocsManifest] = await Promise.all([
      resolveComponentDocs(mergedComponents, manifests, load, fullTransform),
      resolveDocsManifestRefs(docsManifest, load, fullTransform),
    ]);

    await writeFile(
      join(manifestsDir, 'components.html'),
      renderComponentsManifest(
        buildComponentsManifest(componentsWithDocs, resolveDocgenMeta(manifests, durationMs)),
        resolvedDocsManifest
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

    if (isDocgenServerManifestMode(features)) {
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
      .then((features) => isDocgenServerManifestMode(features ?? {}));
    return useDocgenServerPromise;
  };

  app.get('/manifests/:name.json', async (req, res) => {
    try {
      if (
        (await isDocgenServerEnabled()) &&
        (req.params.name === 'components' || req.params.name === 'docs')
      ) {
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
