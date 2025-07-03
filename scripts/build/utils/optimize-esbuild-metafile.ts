import { writeFile } from 'node:fs/promises';

import type { Metafile } from 'esbuild';

/**
 * Optimize the esbuild metafile to only include the inputs that are actually used.
 *
 * When ESBuild is used with the `metafile` option, it will include all the files in the context,
 * even if they are not actually used by any of the output files.
 *
 * This creates very large JSON file, and those cannot be visualized well.
 *
 * This function will optimize the metafile to only include the inputs that are actually used.
 *
 * @param metafile - The metafile (esbuild.Metafile) to optimize.
 * @param location - The location of the metafile to write to on disk.
 */
export async function writeOptimizedMetafile(metafile: Metafile, location: string) {
  const startInputs = Object.values(metafile.outputs).flatMap((value) => Object.keys(value.inputs));
  const allInputs = metafile.inputs;

  const outcome: Metafile['inputs'] = {};

  function recurseAddToOutcome(input: string) {
    if (outcome[input]) {
      return;
    }
    const value = allInputs[input];

    if (!value) {
      return;
    }

    outcome[input] = value;
    if (value.imports) {
      value.imports
        .filter((i) => !i.external)
        .map((i) => i.path)
        .forEach(recurseAddToOutcome);
    }
  }

  startInputs.forEach(recurseAddToOutcome);
  metafile.inputs = outcome;

  await writeFile(location, JSON.stringify(metafile, null, 2));
}
