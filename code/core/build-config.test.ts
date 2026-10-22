import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import buildConfig from './build-config.ts';

/*
 * The `sideEffects` list in package.json is what esbuild consults for every consumer of this
 * package, while the entries here define what the package ships. The two must stay in lockstep:
 * each listed path marks a runtime/manager registration entry (or its dist output) whose side
 * effects must survive tree-shaking. When an entry is renamed or a registering entry is added,
 * update that list too — the build-time counterpart that protects the same registrations inside
 * the manager build lives in src/builder-manager/utils/managerEntrySideEffects.ts.
 */

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as {
  sideEffects: string[];
};

describe('sideEffects list in package.json', () => {
  const entryPoints = Object.values(buildConfig.entries)
    .flat()
    .map((entry) => entry.entryPoint);

  const distOutputs = entryPoints.map(
    (entryPoint) => `./dist/${entryPoint.replace(/^\.\/src\//, '').replace(/\.tsx?$/, '.js')}`
  );

  it('only lists build entry points or their dist outputs', () => {
    for (const listedPath of packageJson.sideEffects) {
      expect(
        [...entryPoints, ...distOutputs],
        `${listedPath} must match a build-config entry point or its dist output`
      ).toContain(listedPath);
    }
  });
});
