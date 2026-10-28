import { afterEach, expect, it, vi } from 'vitest';

import { definePreview } from 'storybook/internal/csf';
import { setProjectAnnotations } from 'storybook/preview-api';

type ComposedAnnotations = {
  initialGlobals?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
};

const FEATURE_GLOBALS = ['backgrounds', 'measureEnabled', 'outline', 'viewport'];
const FEATURE_PARAMETERS = ['backgrounds', 'throwPlayFunctionExceptions'];

const pick = (source: Record<string, unknown> = {}, keys: string[]): Record<string, unknown> =>
  Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));

afterEach(() => {
  vi.unstubAllGlobals();
});

it.each<[string, () => ComposedAnnotations]>([
  ['setProjectAnnotations from storybook/preview-api', () => setProjectAnnotations([{}])],
  ['definePreview from storybook/internal/csf', () => definePreview({}).composed],
])('%s composes the built-in feature annotations', (_route, compose) => {
  vi.stubGlobal('globalProjectAnnotations', undefined);
  vi.stubGlobal('__STORYBOOK_SET_PROJECT_ANNOTATIONS_CALLED__', undefined);
  const { initialGlobals, parameters } = compose();

  expect({
    initialGlobals: pick(initialGlobals, FEATURE_GLOBALS),
    parameters: pick(parameters, FEATURE_PARAMETERS),
  }).toMatchInlineSnapshot(`
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
        "throwPlayFunctionExceptions": false,
      },
    }
  `);
});
