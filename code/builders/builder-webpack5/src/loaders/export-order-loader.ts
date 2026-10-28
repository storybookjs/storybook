import { appendNamedExportsOrder } from '@storybook/core/internal/preview-page';

import type { LoaderContext } from 'webpack';

type Callback = ReturnType<LoaderContext<unknown>['async']>;

export default async function loader(
  this: LoaderContext<unknown>,
  source: string,
  map: Parameters<Callback>[2],
  meta: Parameters<Callback>[3]
): Promise<void> {
  const callback = this.async();
  try {
    const result = await appendNamedExportsOrder(source, this.resourcePath);
    // The statement is appended after the last line, so the incoming source map stays valid.
    callback(null, result?.code ?? source, map, meta);
  } catch {
    callback(null, source, map, meta);
  }
}
