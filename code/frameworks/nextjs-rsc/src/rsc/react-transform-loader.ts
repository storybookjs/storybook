// @ts-expect-error no dts file
import { getSource, transformSource } from 'react-server-dom-webpack/node-loader';
import type { LoaderContext } from 'webpack';

export default async function reactTransformLoader(
  this: LoaderContext<unknown>,
  code: string,
  map: any
): Promise<void> {
  const callback = this.async();
  try {
    const url = 'file://' + this.resourcePath;

    await getSource(url, { format: 'module' }, async (url: string) => {
      return { source: code };
    });

    const { source } = await transformSource(
      code,
      { format: 'module', url: url },
      async (source: string) => ({
        source,
      })
    );
    callback(null, source, map);
  } catch (err) {
    if (err instanceof Error) {
      callback(err);
    }
  }
}
