import type { IndexEntry } from 'storybook/internal/types';
import { toId } from 'storybook/internal/csf';
import { loadCsf } from 'storybook/internal/csf-tools';

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import {
  createDocgenProvider,
  DEFAULT_TYPE_PROPERTY,
  type WebComponentsDocgenPayload,
} from '../../../../renderers/web-components/src/docgen/index.ts';
import { isPublicField } from '../../../../renderers/web-components/src/docgen/component-docgen/arg-types/map-arg-types.ts';
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

const VARIANTS = [
  { manifest: 'custom-elements.json', osaPrefix: 'osa-', legacyPrefix: '' },
  { manifest: 'custom-elements.v2.json', osaPrefix: 'osa-v2-', legacyPrefix: 'v2-' },
] as const;

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
    typeProperty: DEFAULT_TYPE_PROPERTY,
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

const hiddenMemberNames = (payload: WebComponentsDocgenPayload): ReadonlySet<string> => {
  const declaration = payload.customElementsManifest?.declaration;
  const members = declaration?.members ?? [];
  const attributes = declaration?.attributes ?? [];
  const publicFieldNames = new Set(
    members
      .filter(isPublicField)
      .flatMap((member) => (typeof member.name === 'string' ? [member.name] : []))
  );
  const hiddenFieldNames = new Set(
    members
      .filter(
        (member) =>
          member.kind === 'field' &&
          typeof member.name === 'string' &&
          !isPublicField(member) &&
          !publicFieldNames.has(member.name) &&
          !attributes.some(
            (attribute) => attribute.fieldName === member.name && attribute.name === member.name
          )
      )
      .map((member) => member.name)
  );
  for (const attribute of attributes) {
    if (attribute.fieldName !== undefined && hiddenFieldNames.has(attribute.fieldName)) {
      hiddenFieldNames.add(attribute.name);
    }
  }
  return hiddenFieldNames;
};

describe('hiddenMemberNames', () => {
  const payloadFor = (declaration: {
    members?: unknown[];
    attributes?: unknown[];
  }): WebComponentsDocgenPayload => ({
    id: 'hidden-members--test',
    jsDocTags: {},
    name: 'hidden-members',
    path: './input.stories.ts',
    customElementsManifest: {
      manifestPath: 'custom-elements.json',
      declaration: declaration as NonNullable<
        WebComponentsDocgenPayload['customElementsManifest']
      >['declaration'],
    },
  });

  it('does not waive hidden fields shadowed by public fields or same-named attributes', () => {
    expect(
      [
        ...hiddenMemberNames(
          payloadFor({
            members: [
              { kind: 'field', name: 'size', static: true },
              { kind: 'field', name: 'size' },
              { kind: 'field', name: 'value', privacy: 'private' },
            ],
            attributes: [{ name: 'value', fieldName: 'value' }],
          })
        ),
      ].sort()
    ).toEqual([]);
  });

  it('waives a private backing field and its public attribute', () => {
    expect(
      [
        ...hiddenMemberNames(
          payloadFor({
            members: [{ kind: 'field', name: '_value', privacy: 'private' }],
            attributes: [{ name: 'value', fieldName: '_value' }],
          })
        ),
      ].sort()
    ).toEqual(['_value', 'value']);
  });
});

describe('web-components server-side docgen baselines', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const entry = entryForFixture(fixtureCase, testDir);

    for (const [index, { manifest, osaPrefix, legacyPrefix }] of VARIANTS.entries()) {
      const manifestPath = join(testDir, manifest);
      if (!existsSync(manifestPath)) {
        continue;
      }

      const payload = (await runProvider(testDir, entry, manifestPath)) as
        | WebComponentsDocgenPayload
        | undefined;

      expect(payload, `${fixtureCase}: no OSA payload recorded`).toBeDefined();
      expect(JSON.stringify(payload)).not.toContain(testDir);
      const argTypes = payload?.argTypes;
      expect(argTypes, `${fixtureCase}: no OSA argTypes recorded`).toBeDefined();

      const legacyArgTypesPath = join(testDir, `${legacyPrefix}argtypes.snapshot`);
      const committedLegacyArgTypes = readCommitted(legacyArgTypesPath);
      expect(committedLegacyArgTypes, `missing legacy ${legacyArgTypesPath}`).toBeDefined();
      await recordArgTypesSnapshot({
        path: join(testDir, `${osaPrefix}argtypes.snapshot`),
        label: `${fixtureCase}/${osaPrefix}argtypes.snapshot`,
        candidate: argTypes!,
        extraGates: [
          {
            committed: committedLegacyArgTypes!,
            label: `${fixtureCase}/${legacyPrefix}argtypes.snapshot`,
            legacyBaseline: true,
            legacyManifestRuntime: true,
            waivedArgs: hiddenMemberNames(payload!),
          },
        ],
      });

      await expect(withoutArgTypes(payload)).toMatchFileSnapshot(
        join(testDir, `${osaPrefix}payload.snapshot`)
      );

      if (index === 0) {
        await expect(payload?.description ?? '').toMatchFileSnapshot(
          join(testDir, 'osa-description.snapshot')
        );
      }
    }
  });
});
