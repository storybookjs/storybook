import type { IndexEntry, StrictArgTypes } from 'storybook/internal/types';
import { toId } from 'storybook/internal/csf';
import { loadCsf } from 'storybook/internal/csf-tools';

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import {
  createDocgenProvider,
  type WebComponentsDocgenPayload,
} from '../../../../renderers/web-components/src/docgen/index.ts';
import { recordArgTypesSnapshot } from '../compare/record-argtypes-snapshot.ts';
import { BASELINE_PATH } from './baseline-path.ts';

if (BASELINE_PATH !== 'legacy') {
  throw new Error(
    'web-components-osa-baselines.test.ts gates the server recorder against the legacy runtime baselines; update the recorder or baseline-path.ts'
  );
}

vi.mock('storybook/internal/node-logger', { spy: true });

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const readCommitted = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined;

beforeEach(() => {
  vi.mocked(logger.warn).mockImplementation(() => {});
  vi.mocked(logger.debug).mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const entryForFixture = (fixtureCase: string, testDir: string): IndexEntry => {
  const source = readFileSync(join(testDir, 'input.stories.ts'), 'utf8');
  const csf = loadCsf(source, { makeTitle: (title) => title }).parse();
  const [firstExport] = Object.keys(csf._stories);
  if (!csf._meta?.title || !firstExport) {
    throw new Error(`${fixtureCase}: input.stories.ts must declare a title and at least one story`);
  }
  return {
    id: toId(fixtureCase, firstExport),
    name: firstExport,
    title: csf._meta.title,
    type: 'story',
    subtype: 'story',
    importPath: './input.stories.ts',
  };
};

const runProvider = async (testDir: string, entry: IndexEntry, manifestPath: string) => {
  vi.spyOn(process, 'cwd').mockReturnValue(testDir);
  const provider = createDocgenProvider({
    manifestPaths: [manifestPath],
  })(async () => undefined);
  return provider({ entry });
};

const withoutArgTypes = (payload: WebComponentsDocgenPayload | undefined) => {
  if (!payload) {
    return payload;
  }
  const { argTypes: _argTypes, ...rest } = payload;
  return rest;
};

describe('web-components server-side docgen baselines', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const entry = entryForFixture(fixtureCase, testDir);
    const payload = (await runProvider(testDir, entry, join(testDir, 'custom-elements.json'))) as
      | WebComponentsDocgenPayload
      | undefined;

    expect(payload, `${fixtureCase}: no OSA payload recorded`).toBeDefined();
    expect(JSON.stringify(payload)).not.toContain(testDir);
    expect(payload?.argTypes, `${fixtureCase}: no OSA argTypes recorded`).toBeDefined();

    const legacyArgTypesPath = join(testDir, 'argtypes.snapshot');
    const committedLegacyArgTypes = readCommitted(legacyArgTypesPath);
    expect(committedLegacyArgTypes, `missing legacy ${legacyArgTypesPath}`).toBeDefined();
    await recordArgTypesSnapshot({
      path: join(testDir, 'osa-argtypes.snapshot'),
      label: `${fixtureCase}/osa-argtypes.snapshot`,
      candidate: payload?.argTypes as StrictArgTypes,
      extraGates: [
        {
          committed: committedLegacyArgTypes!,
          label: `${fixtureCase}/argtypes.snapshot`,
          legacyBaseline: true,
        },
      ],
    });

    await expect(withoutArgTypes(payload)).toMatchFileSnapshot(
      join(testDir, 'osa-payload.snapshot')
    );
    await expect(payload?.description ?? '').toMatchFileSnapshot(
      join(testDir, 'osa-description.snapshot')
    );

    const variantManifestPath = join(testDir, 'custom-elements.v2.json');
    if (existsSync(variantManifestPath)) {
      const variantPayload = (await runProvider(testDir, entry, variantManifestPath)) as
        | WebComponentsDocgenPayload
        | undefined;
      const legacyVariantArgTypesPath = join(testDir, 'v2-argtypes.snapshot');
      const committedLegacyVariantArgTypes = readCommitted(legacyVariantArgTypesPath);
      expect(
        committedLegacyVariantArgTypes,
        `missing legacy ${legacyVariantArgTypesPath}`
      ).toBeDefined();
      await recordArgTypesSnapshot({
        path: join(testDir, 'osa-v2-argtypes.snapshot'),
        label: `${fixtureCase}/osa-v2-argtypes.snapshot`,
        candidate: variantPayload?.argTypes as StrictArgTypes,
        extraGates: [
          {
            committed: committedLegacyVariantArgTypes!,
            label: `${fixtureCase}/v2-argtypes.snapshot`,
            legacyBaseline: true,
          },
        ],
      });

      await expect(withoutArgTypes(variantPayload)).toMatchFileSnapshot(
        join(testDir, 'osa-v2-payload.snapshot')
      );
    }
  });
});
