import { writeFile } from 'node:fs/promises';

import type { Metafile } from 'esbuild';

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
