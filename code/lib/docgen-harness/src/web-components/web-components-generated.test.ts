import type { IndexEntry } from 'storybook/internal/types';
import { toId } from 'storybook/internal/csf';
import { loadCsf } from 'storybook/internal/csf-tools';

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import {
  createDocgenProvider,
  type WebComponentsDocgenPayload,
} from '../../../../renderers/web-components/src/docgen/index.ts';
import { GeneratorManager } from '../../../../renderers/web-components/src/docgen/component-docgen/source/generator-manager.ts';
import { parseArgTypesSnapshot } from '../compare/parse-snapshot.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock(
  '../../../../renderers/web-components/src/docgen/component-docgen/source/generator-manager.ts',
  {
    spy: true,
  }
);

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const UNSUPPORTED_FIXTURES: Record<string, string> = {
  'fast-attributes': 'FAST decorators are not handled by the loaded Lit generator plugin.',
  'stencil-props': 'Stencil decorators are not handled by the loaded Lit generator plugin.',
};

const WAIVED_ARGTYPES: Record<string, Record<string, string>> = {
  'demo-wc-card': {
    'back-side': 'Generator omitted the JSDoc description that the committed manifest has.',
    backSide: 'Generator omitted the JSDoc description that the committed manifest has.',
    header: 'Generator omitted the JSDoc description that the committed manifest has.',
    'prefix-slot':
      'Generator emitted an extra prefix slot argType that is absent from the snapshot.',
    rows: 'Generator omitted the JSDoc description and emitted object instead of array type.',
    'side-changed-event': 'Generator emitted Event instead of CustomEvent.',
    'toggle-method': 'Generator emitted () => void instead of ().',
  },
  'lit-basic-attributes': {
    count: 'Generator omitted the default value 2.',
    disabled: 'Generator omitted the default value false.',
    'is-open': 'Generator omitted the default value false.',
    isOpen: 'Generator omitted the default value false.',
    label: "Generator omitted the default value 'Basic label'.",
  },
  'lit-events': {
    'close-method': 'Generator emitted () => void instead of ().',
    'emitChange-method': 'Generator emitted () => void instead of ().',
    value: "Generator omitted the default value 'ready'.",
  },
  'lit-inheritance-mixin': {
    'base-label': "Generator omitted the inherited description and default value 'Final'.",
    baseLabel: "Generator omitted the inherited description and default value 'Final'.",
    count: 'Generator omitted the default value 1.',
    'mixed-active': 'Generator omitted the default value false.',
    mixedActive: 'Generator omitted the default value false.',
  },
  'lit-property-only': {
    config:
      'Generator omitted the default object value and emitted an object control instead of disabling controls.',
    items: 'Generator omitted the default array value.',
    label: "Generator omitted the default value 'Items'.",
  },
  'lit-schema-warning': {
    count: 'Generator omitted the default value 0.',
    label: "Generator omitted the default value 'Label'.",
  },
  'lit-slots-and-css': {
    heading: "Generator omitted the default value 'Details'.",
  },
  'lit-toolkit-shapes': {
    '--toolkit-color':
      'Generator omitted the CSS property syntax type, so color control cannot be inferred.',
    '--toolkit-scale':
      'Generator omitted the CSS property syntax type, so the value falls back to string.',
    'active-state': 'Generator omitted the CSS state declaration.',
    'click-event': 'Generator emitted Event instead of CustomEvent.',
    computed: 'Generator did not mark the readonly getter as disabled controls.',
    label: "Generator omitted the default value 'Label'.",
    level: 'Generator omitted the default value 1.',
    'old-size': "Generator omitted the default value ''.",
    oldSize: "Generator omitted the default value ''.",
    onSelect: 'Generator omitted the explicit undefined default summary.',
    pressed: 'Generator omitted the default value false.',
    size: "Generator omitted the default value 'medium'.",
    tags: "Generator omitted the default value ['a'].",
    target: "Generator omitted the default value 'self'.",
    'toolkit-resize-event':
      'Generator preserved the Size alias in CustomEvent detail instead of expanding the union.',
    version: 'Generator emitted literal enum "1.0.0" instead of string.',
    when: 'Generator omitted the default value new Date(0).',
  },
  'lit-union-jsdoc': {
    label: 'Generator emitted the string default with double quotes instead of single quotes.',
    'old-label': "Generator omitted the default value ''.",
    oldLabel: "Generator omitted the default value ''.",
    variant: "Generator omitted the default value 'primary'.",
  },
  'vanilla-basic': {
    'legacy-label': 'Generator split the inline @deprecated text out of the attribute description.',
  },
  'vanilla-multi-definition': {
    betaLabel:
      'Generator emitted string instead of disabling controls for the getter/setter property.',
  },
};

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

beforeEach(() => {
  vi.mocked(logger.warn).mockImplementation(() => {});
  vi.mocked(logger.debug).mockImplementation(() => {});
  vi.mocked(GeneratorManager.prototype.startWatching).mockImplementation(() => {});
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

const runProvider = async (testDir: string, entry: IndexEntry) => {
  vi.spyOn(process, 'cwd').mockReturnValue(testDir);
  const provider = createDocgenProvider({
    autoGenerateManifest: true,
    manifestPaths: [],
  })(async () => undefined);
  return provider({ entry });
};

const withoutWaived = <T extends object>(argTypes: T, fixtureCase: string): Partial<T> => {
  const waived = WAIVED_ARGTYPES[fixtureCase] ?? {};
  return Object.fromEntries(
    Object.entries(argTypes).filter(([name]) => !Object.hasOwn(waived, name))
  ) as Partial<T>;
};

const expectedManifestPath = (fixtureCase: string, tag: string): string => {
  const manifest = JSON.parse(
    readFileSync(join(fixturesDir, fixtureCase, 'custom-elements.json'), 'utf8')
  ) as { modules?: { path?: string; declarations?: { tagName?: string }[] }[] };

  for (const module of manifest.modules ?? []) {
    if (module.declarations?.some((declaration) => declaration.tagName === tag) && module.path) {
      return module.path;
    }
  }
  throw new Error(`${fixtureCase}: custom-elements.json has no declaration for ${tag}`);
};

describe('web-components generated source docgen', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const entry = entryForFixture(fixtureCase, testDir);
    const payload = (await runProvider(testDir, entry)) as WebComponentsDocgenPayload | undefined;

    if (fixtureCase in UNSUPPORTED_FIXTURES) {
      expect(payload?.error?.name).toBe('tag-not-found');
      return;
    }

    expect(payload, `${fixtureCase}: no generated payload`).toBeDefined();
    expect(payload?.error, `${fixtureCase}: generated payload error`).toBeUndefined();
    expect(payload?.argTypes, `${fixtureCase}: no generated argTypes`).toBeDefined();

    const committed = parseArgTypesSnapshot(
      readFileSync(join(testDir, 'osa-argtypes.snapshot'), 'utf8'),
      `${fixtureCase}/osa-argtypes.snapshot`
    );
    expect(withoutWaived(payload!.argTypes!, fixtureCase)).toEqual(
      withoutWaived(committed, fixtureCase)
    );
    expect(payload?.customElementsManifest?.manifestPath).toBe(
      expectedManifestPath(fixtureCase, payload!.name)
    );
  });
});
