import { minify } from 'rolldown/utils';

// The `minify` function that TerserWebpackPlugin calls for `build.test.esbuildMinify`: one asset of
// the compilation, with the name webpack gave it.
export const fastMinify = async (
  input: Record<string, string>,
  sourceMap: unknown,
  { module = false }: { module?: boolean }
) => {
  const [[fileName, source]] = Object.entries(input);
  // Rolldown reads from the extension whether the file is a script, and the name of an asset ends
  // with the `?query` of `output.filename`. A script it takes for a module loses its `"use strict"`
  // directives and its top-level declarations.
  const { code, map, errors } = await minify(fileName.replace(/\?.*$/, ''), source, {
    module,
    sourcemap: Boolean(sourceMap),
  });
  const messages = (isError: boolean) =>
    errors
      .filter((error) => (error.severity === 'Error') === isError)
      .map((error) => new Error(error.message));
  return {
    code,
    // webpack joins this map to the one of the asset by the name of the asset.
    map: map && { ...map, sources: [fileName] },
    errors: messages(true),
    warnings: messages(false),
  };
};
