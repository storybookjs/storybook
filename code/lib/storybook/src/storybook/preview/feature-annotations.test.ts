import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { definePreview } from 'storybook/internal/csf';
import { setProjectAnnotations as setCollectedProjectAnnotations } from 'storybook/internal/preview-api';
import { setProjectAnnotations } from 'storybook/preview-api';

import { join, relative } from 'pathe';

import backgrounds from '../../features/backgrounds/preview.ts';
import { builtInAddons } from '../../features/index.ts';
import measure from '../../features/measure/preview.ts';
import outline from '../../features/outline/preview.ts';
import viewport from '../../features/viewport/preview.ts';
import { BUILT_IN_PREVIEW_ANNOTATIONS } from './built-in-annotations.ts';

type ComposedAnnotations = {
  initialGlobals?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
};

const CODE_DIR = join(import.meta.dirname, '../../../../..');
const BUILT_INS = [measure, backgrounds, outline, viewport];
const FEATURE_GLOBALS = ['backgrounds', 'measureEnabled', 'outline', 'viewport'];
const FEATURE_PARAMETERS = ['backgrounds'];

const pick = (source: Record<string, unknown> = {}, keys: string[]): Record<string, unknown> =>
  Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));

const features = ({ initialGlobals, parameters }: ComposedAnnotations): ComposedAnnotations => ({
  initialGlobals: pick(initialGlobals, FEATURE_GLOBALS),
  parameters: pick(parameters, FEATURE_PARAMETERS),
});

/** The source of every preview file the built-in addons hand to `preview:annotations:collect`. */
function collectedPreviewSources(): string[] {
  const sources: string[] = [];
  for (const addon of builtInAddons) {
    // Setups register their hooks before their first `callHook`, which never settles here.
    void addon.setup({
      hook: (name: string, collect: () => string[]) => {
        if (name === 'preview:annotations:collect') {
          sources.push(
            ...collect().map((file) => file.replace('/dist/', '/src/').replace(/\.js$/, '.ts'))
          );
        }
      },
      callHook: () => new Promise(() => {}),
    } as never);
  }
  return sources;
}

beforeEach(() => {
  vi.stubGlobal('globalProjectAnnotations', undefined);
  vi.stubGlobal('defaultProjectAnnotations', undefined);
  vi.stubGlobal('__STORYBOOK_SET_PROJECT_ANNOTATIONS_CALLED__', undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('lists the preview annotations the built-in addons collect, in order', async () => {
  const sources = collectedPreviewSources();
  const collected = await Promise.all(
    sources.map(async (source) => (await import(source)).default)
  );

  expect(sources.map((source) => relative(CODE_DIR, source))).toMatchInlineSnapshot(`
    [
      "lib/storybook/src/features/measure/preview.ts",
      "lib/storybook/src/features/backgrounds/preview.ts",
      "lib/storybook/src/features/highlight/preview.ts",
      "lib/storybook/src/features/outline/preview.ts",
      "lib/storybook/src/features/viewport/preview.ts",
      "lib/storybook/src/features/actions/preview.ts",
      "lib/storybook/src/features/component-testing/preview.ts",
      "core/src/test/preview.ts",
      "core/src/story-index/ghost-stories/test-annotations.ts",
      "core/src/shared/open-service/services/docgen/preview.ts",
      "core/src/shared/open-service/services/story-docs/preview.ts",
    ]
  `);
  expect(BUILT_IN_PREVIEW_ANNOTATIONS.map((entry) => sources[collected.indexOf(entry)])).toEqual(
    sources
  );
});

it('adds the built-in annotations only from the public portable stories entry', () => {
  expect({
    'storybook/preview-api': features(setProjectAnnotations([{}])),
    'storybook/internal/preview-api': features(setCollectedProjectAnnotations([{}])),
    // Renderers pass the built-ins as its defaults.
    'storybook/internal/csf': features(definePreview({}).composed),
  }).toMatchInlineSnapshot(`
    {
      "storybook/internal/csf": {
        "initialGlobals": {},
        "parameters": {},
      },
      "storybook/internal/preview-api": {
        "initialGlobals": {},
        "parameters": {},
      },
      "storybook/preview-api": {
        "initialGlobals": {
          "backgrounds": {
            "grid": false,
            "value": undefined,
          },
          "measureEnabled": false,
          "outline": false,
          "viewport": {
            "isRotated": false,
            "value": undefined,
          },
        },
        "parameters": {
          "backgrounds": {
            "disable": false,
            "grid": {
              "cellAmount": 5,
              "cellSize": 20,
              "opacity": 0.5,
            },
          },
        },
      },
    }
  `);
});

it('never writes the renderer defaults global from the public setProjectAnnotations', () => {
  const rendererDefaults = { parameters: { renderer: true } };
  const write = vi.fn();
  Object.defineProperty(globalThis, 'defaultProjectAnnotations', {
    configurable: true,
    get: () => rendererDefaults,
    set: write,
  });

  const composed = setProjectAnnotations([{ parameters: { project: true } }]);

  expect(write).not.toHaveBeenCalled();
  expect(pick(composed.parameters, ['backgrounds', 'renderer', 'project'])).toMatchObject({
    backgrounds: { disable: false },
    renderer: true,
    project: true,
  });
});

it('composes the collected built-in annotations before the project', () => {
  expect(features(setCollectedProjectAnnotations([...BUILT_INS, {}]))).toMatchInlineSnapshot(`
    {
      "initialGlobals": {
        "backgrounds": {
          "grid": false,
          "value": undefined,
        },
        "measureEnabled": false,
        "outline": false,
        "viewport": {
          "isRotated": false,
          "value": undefined,
        },
      },
      "parameters": {
        "backgrounds": {
          "disable": false,
          "grid": {
            "cellAmount": 5,
            "cellSize": 20,
            "opacity": 0.5,
          },
        },
      },
    }
  `);
});
