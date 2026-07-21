import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parse } from 'vue-docgen-api';

import { extractArgTypes } from '../../../../renderers/vue3/src/extractArgTypes.ts';
import { generateSourceCode } from '../../../../renderers/vue3/src/docs/sourceDecorator.ts';
import { BASELINE_PATH } from './baseline-path.ts';

// Records the legacy Vue docgen "before" baselines: the normalized StrictArgTypes produced by
// extractArgTypes and the dynamic Source-block snippet produced by generateSourceCode, per fixture.
// Both consume the same __docgenInfo object, attached exactly like the production Vite plugin
// (code/frameworks/vue3-vite/src/plugins/vue-docgen.ts) does: parse() with zero options, then
// Object.assign with a JSON roundtrip (production embeds the metadata via JSON.stringify, which
// drops undefined-valued keys). Thin or empty output is the truthful "before" state - never
// "fix" it by simplifying a fixture.
// Note: snippet generation must stay on this legacy path; do not stub
// FEATURES.experimentalDocgenServer, which would route snippets through the OSA story-docs
// service instead of the per-renderer sourceDecorator.

// Binds the recorder to the declared baseline path: re-pointing it at another engine must
// flip BASELINE_PATH, which in turn hardens the red markers in vue3-legacy-gaps.test.ts.
if (BASELINE_PATH !== 'legacy') {
  throw new Error(
    'vue3-baselines.test.ts records the legacy vue-docgen-api path; update the recorder or baseline-path.ts'
  );
}

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

type DocgenComponent = {
  name?: string;
  __name?: string;
  __docgenInfo?: unknown;
};

describe('vue3 legacy baselines', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const sfcFiles = readdirSync(testDir).filter((file) => file.endsWith('.vue'));
    expect(sfcFiles).toHaveLength(1);

    const metaData = await parse(join(testDir, sfcFiles[0]));

    const storiesModule = await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`);
    const { default: meta, ...stories } = storiesModule;

    const component: DocgenComponent = meta.component;
    component.__docgenInfo = Object.assign(
      { displayName: component.name ?? component.__name },
      JSON.parse(JSON.stringify(metaData))
    );

    await expect(extractArgTypes(component)).toMatchFileSnapshot(
      join(testDir, 'argtypes.snapshot')
    );

    for (const [exportName, story] of Object.entries<{ args?: Record<string, unknown> }>(stories)) {
      const ctx = {
        title: meta.title,
        component,
        args: { ...meta.args, ...story.args },
      };
      await expect(generateSourceCode(ctx)).toMatchFileSnapshot(
        join(testDir, `snippet-${exportName}.snapshot`)
      );
    }
  });
});
