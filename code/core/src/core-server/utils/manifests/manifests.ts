import { mkdir, writeFile } from 'node:fs/promises';

import { selectComponentEntriesByComponentId } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { Manifests, Presets } from 'storybook/internal/types';

import { join } from 'pathe';
import type { Polka } from 'polka';
import invariant from 'tiny-invariant';

import { getService } from '../../../shared/open-service/server.ts';
import { docgenServiceDef } from '../../../shared/open-service/services/docgen/definition.ts';
import { Tag } from '../../../shared/constants/tags.ts';
import type { ComponentManifest, ComponentsManifest } from '../../../types/modules/core-common.ts';
import type { DocgenPayload } from '../../../shared/open-service/services/docgen/types.ts';
import { buildComponentsRefManifest, loadComponentManifestIndexEntriesFromDisk } from './json-references.ts';
import { type DocsManifest, renderComponentsManifest } from './render-components-manifest.ts';

/**
 * Wraps docgen payloads in a {@link ComponentsManifest} shell for the HTML debugger.
 *
 * Docgen engine metadata (`meta.docgen`) is supplied by the renderer through
 * `experimental_manifests` — core does not infer it from payload shape.
 */
function buildComponentsManifest(
  components: Record<string, DocgenPayload>,
  meta: ComponentsManifest['meta']
): ComponentsManifest {
  return {
    v: 0,
    components: components as Record<string, ComponentManifest>,
    meta,
  };
}

/** Narrows an unknown manifest value to the docs manifest shape used by the HTML debugger. */
function isDocsManifest(manifest: unknown): manifest is DocsManifest {
  return typeof manifest === 'object' && manifest !== null && 'docs' in manifest;
}

/**
 * Returns component ids for index entries tagged with `manifest`.
 *
 * Uses the same component-id selection rules as docgen extraction and the legacy React manifest
 * generator.
 */
async function getManifestComponentIds(presets: Presets) {
  const generator = await presets.apply('storyIndexGenerator');
  invariant(generator, 'storyIndexGenerator must be configured');
  const index = await generator.getIndex();
  const manifestEntries = Object.values(index.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );

  return Array.from(selectComponentEntriesByComponentId(manifestEntries).keys());
}

/**
 * Loads all manifests from the `experimental_manifests` preset for entries tagged `manifest`.
 */
async function getManifests(presets: Presets, { watch }: { watch?: boolean } = {}) {
  const generator = await presets.apply('storyIndexGenerator');
  invariant(generator, 'storyIndexGenerator must be configured');
  const index = await generator.getIndex();
  const manifestEntries = Object.values(index.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );

  return (
    (await presets.apply<Manifests>('experimental_manifests', undefined, {
      manifestEntries,
      watch,
    })) ?? {}
  );
}

/**
 * Builds the components HTML debugger page from the docgen open service.
 *
 * Loads all docgen payloads, filters to manifest-tagged component ids, and merges renderer-supplied
 * metadata from `experimental_manifests` (notably `meta.docgen`).
 */
async function renderComponentsHtmlFromDocgenService(presets: Presets, docsManifest?: DocsManifest) {
  const docgenService = getService<typeof docgenServiceDef>('core/docgen');
  const startTime = performance.now();
  const allPayloads = await docgenService.queries.getDocgenForAllComponents.loaded();
  const durationMs = Math.round(performance.now() - startTime);
  const manifestIds = await getManifestComponentIds(presets);
  const components = Object.fromEntries(
    manifestIds.flatMap((id) => (allPayloads[id] ? [[id, allPayloads[id]]] : []))
  );
  const manifests = await getManifests(presets);
  const presetMeta = manifests.components?.meta;
  invariant(
    presetMeta?.docgen,
    'experimental_manifests must supply components.meta.docgen when experimentalDocgenServer is enabled'
  );

  return renderComponentsManifest(
    buildComponentsManifest(components, {
      docgen: presetMeta.docgen,
      durationMs,
    }),
    docsManifest
  );
}

/** Creates `outputDir/manifests` if it does not exist. */
async function ensureManifestsDir(outputDir: string) {
  await mkdir(join(outputDir, 'manifests'), { recursive: true });
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

/** Writes the components HTML debugger page to `outputDir/manifests/components.html`. */
async function writeComponentsHtml(outputDir: string, html: string) {
  await writeFile(join(outputDir, 'manifests', 'components.html'), html);
}

/**
 * Static build path when `features.experimentalDocgenServer` is enabled.
 *
 * Writes a ref-based `components.json`, other manifests from `experimental_manifests`, and
 * `components.html` rendered from the docgen service.
 */
async function writeDocgenServerManifests(outputDir: string, presets: Presets) {
  const manifestComponentIds = await getManifestComponentIds(presets);
  const manifests = await getManifests(presets);
  const docsManifest = isDocsManifest(manifests.docs) ? manifests.docs : undefined;
  const hasOtherManifests = Object.keys(manifests).some((name) => name !== 'components');
  const shouldWriteHtml = manifestComponentIds.length > 0 || docsManifest;

  if (!hasOtherManifests && !shouldWriteHtml) {
    return;
  }

  await ensureManifestsDir(outputDir);

  if (manifestComponentIds.length > 0) {
    const components = await loadComponentManifestIndexEntriesFromDisk(
      outputDir,
      manifestComponentIds
    );

    await writeFile(
      join(outputDir, 'manifests', 'components.json'),
      JSON.stringify(buildComponentsRefManifest(components, manifests.components?.meta))
    );
  }

  await writeManifestJsonFiles(outputDir, manifests, { skipComponents: true });

  if (shouldWriteHtml) {
    await writeComponentsHtml(
      outputDir,
      await renderComponentsHtmlFromDocgenService(presets, docsManifest)
    );
  }
}

/**
 * Static build path for the legacy inline components manifest from `experimental_manifests`.
 */
async function writeLegacyManifests(outputDir: string, presets: Presets) {
  const manifests = await getManifests(presets);
  const docsManifest = isDocsManifest(manifests.docs) ? manifests.docs : undefined;

  if (Object.keys(manifests).length === 0) {
    return;
  }

  await ensureManifestsDir(outputDir);
  await writeManifestJsonFiles(outputDir, manifests);

  if ('components' in manifests || 'docs' in manifests) {
    await writeComponentsHtml(
      outputDir,
      renderComponentsManifest(manifests.components, docsManifest)
    );
  }
}

/** Writes manifest JSON (and HTML when applicable) to `outputDir/manifests/`. */
export async function writeManifests(outputDir: string, presets: Presets) {
  try {
    const features = await presets.apply('features');

    if (features.experimentalDocgenServer) {
      await writeDocgenServerManifests(outputDir, presets);
      return;
    }

    await writeLegacyManifests(outputDir, presets);
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

      const manifests = await getManifests(presets, { watch: true });
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
      const manifests = await getManifests(presets, { watch: true });
      const docsManifest = isDocsManifest(manifests.docs) ? manifests.docs : undefined;

      if (await isDocgenServerEnabled()) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(await renderComponentsHtmlFromDocgenService(presets, docsManifest));
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
