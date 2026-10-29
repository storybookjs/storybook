import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, relative } from 'node:path';

import type { Metafile, OutputFile } from 'esbuild';
import { resolve } from 'pathe';
// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';

import type { Compilation } from '../types.ts';

/** Manager output URLs, as the HTML template references them. */
export interface ManagerFiles {
  /** Stylesheets to link. */
  cssFiles: string[];
  /** Every script, entries and shared chunks, to preload. */
  jsFiles: string[];
  /** Entry scripts to import, in `entryPoints` order. */
  entryFiles: string[];
}

/** Write the compiled manager files into `addonsDir` and return their URLs. */
export async function readOrderedFiles(
  addonsDir: string,
  compilation: Pick<Compilation, 'outputFiles' | 'metafile'>,
  entryPoints: string[]
): Promise<ManagerFiles> {
  const urls = new Map<string, string>();
  await Promise.all(
    compilation.outputFiles?.map(async (file) => {
      // convert deeply nested paths to a single level, also remove special characters
      const { location, url } = sanitizePath(file, addonsDir);

      if (!existsSync(location)) {
        const directory = dirname(location);
        await mkdir(directory, { recursive: true });
      }
      await writeFile(location, file.contents);
      urls.set(resolve(file.path), url);
    }) || []
  );

  const files = [...urls.values()];
  const entryFiles = getEntryOutputs(compilation.metafile, entryPoints).map((output) => {
    const url = urls.get(output);
    if (!url) {
      throw new Error(`Manager entry output ${output} was not emitted.`);
    }
    return url;
  });
  return {
    cssFiles: files.filter((file) => file.endsWith('.css')),
    jsFiles: files.filter((file) => file.endsWith('.js')),
    entryFiles,
  };
}

/** Absolute paths of the JS outputs of `entryPoints`, in the same order. */
export function getEntryOutputs(
  metafile: Metafile | undefined,
  entryPoints: string[],
  cwd = process.cwd()
): string[] {
  if (!metafile) {
    throw new Error('The manager build must produce a metafile to order its entries.');
  }
  const outputs = new Map<string, string>();
  for (const [output, { entryPoint }] of Object.entries(metafile.outputs)) {
    if (entryPoint && output.endsWith('.js')) {
      outputs.set(resolve(cwd, entryPoint), resolve(cwd, output));
    }
  }
  return entryPoints.map((entry) => {
    const output = outputs.get(resolve(cwd, entry));
    if (!output) {
      throw new Error(`Manager entry ${entry} has no output.`);
    }
    return output;
  });
}

export function sanitizePath(file: OutputFile, addonsDir: string) {
  const filePath = relative(addonsDir, file.path);
  const location = normalize(join(addonsDir, filePath));
  const url = `./sb-addons/${slash(filePath).split('/').map(encodeURIComponent).join('/')}`;

  return { location, url };
}
