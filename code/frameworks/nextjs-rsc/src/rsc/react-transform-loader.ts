import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { LoaderContext } from 'webpack';

// @ts-expect-error js file
import { getSource, transformSource } from './react-server-dom-webpack-node-loader';

export default async function reactTransformLoader(
  this: LoaderContext<unknown>,
  code: string,
  map: any
): Promise<void> {
  const callback = this.async();
  try {
    const resourceUrl = 'file://' + this.resourcePath;

    const { source } = await getSource(resourceUrl, { format: 'module' }, async (url: string) => {
      if (resourceUrl === url) {
        return { source: code };
      }
      if (url.endsWith('.map')) {
        return { source: await readFile(join(this.context, url)) };
      }
      throw new Error(`Cannot load ${url}`);
    });

    const transformed = await transformSource(
      source,
      { format: 'module', url: resourceUrl },
      async (source: string) => ({ source })
    );
    callback(null, transformed.source, map);
  } catch (err) {
    if (err instanceof Error) {
      callback(err);
    }
  }
}
