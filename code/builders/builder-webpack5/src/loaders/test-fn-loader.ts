import { testTransform } from 'storybook/internal/csf-tools';

import type { LoaderContext } from 'webpack';

/** This transforms the test function of a story into another story */
export default async function loader(
  this: LoaderContext<any>,
  source: string,
  map: any,
  meta: any
) {
  const callback = this.async();
  const storiesRegex = /\.stories\.(tsx?|jsx?)$/;

  try {
    // Only process story files
    if (!storiesRegex.test(this.resourcePath)) {
      return callback(null, source, map, meta);
    }

    const result = await testTransform({
      code: source,
      fileName: this.resourcePath,
    });

    // Handle both string and GeneratorResult types
    const transformedCode = typeof result === 'string' ? result : result.code;

    return callback(null, transformedCode, map, meta);
  } catch (err) {
    // If transformation fails, return original source
    return callback(null, source, map, meta);
  }
}
