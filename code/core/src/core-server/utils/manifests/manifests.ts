import { mkdir, writeFile } from 'node:fs/promises';

import { logger } from 'storybook/internal/node-logger';
import type { ComponentsManifest, Manifests, Presets } from 'storybook/internal/types';

import { join } from 'pathe';
import type { Polka } from 'polka';
import invariant from 'tiny-invariant';

import { renderComponentsManifest } from './render-components-manifest';

async function getManifests(presets: Presets) {
  const generator = await presets.apply('storyIndexGenerator');
  invariant(generator, 'storyIndexGenerator must be configured');
  const index = await generator.getIndex();
  const manifestEntries = Object.values(index.entries).filter(
    (entry) => entry.tags?.includes('manifest') ?? false
  );

  return await presets.apply<Manifests>('experimental_manifests', undefined, {
    manifestEntries,
  });
}

export async function writeManifests(outputDir: string, presets: Presets) {
  try {
    const manifests = await getManifests(presets);
    if (Object.keys(manifests).length === 0) {
      return;
    }
    await mkdir(join(outputDir, 'manifests'), { recursive: true });
    await Promise.all(
      Object.entries(manifests).map(([name, content]) =>
        writeFile(join(outputDir, 'manifests', `${name}.json`), JSON.stringify(content))
      )
    );
    if ('components' in manifests) {
      await writeFile(
        join(outputDir, 'manifests', 'components.html'),
        renderComponentsManifest(manifests.components as ComponentsManifest)
      );
    }
  } catch (e) {
    logger.error('Failed to generate manifests');
    logger.error(e instanceof Error ? e : String(e));
  }
}

export function registerManifests({ app, presets }: { app: Polka; presets: Presets }) {
  app.get('/manifests/:name.json', async (req, res) => {
    try {
      const manifests = await getManifests(presets);
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
      const manifests = await getManifests(presets);
      const manifest = manifests.components;

      if (!manifest) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<pre>No components manifest configured.</pre>`);
        return;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(renderComponentsManifest(manifest));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<pre>${e instanceof Error ? e.stack : String(e)}</pre>`);
    }
  });
}
