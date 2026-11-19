// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { global } from '@storybook/global';

import { logger, once } from 'storybook/internal/client-logger';

import customElementsManifest from './__testfixtures__/custom-elements.json';
import { extractArgTypes, extractArgTypesFromElements } from './custom-elements';

const { window } = global;

describe('extractArgTypes', () => {
  beforeEach((): void => {
    once.clear();
    window.__STORYBOOK_CUSTOM_ELEMENTS_MANIFEST__ = customElementsManifest;
  });

  afterEach((): void => {
    vi.restoreAllMocks();
    once.clear();
    window.__STORYBOOK_CUSTOM_ELEMENTS_MANIFEST__ = undefined;
  });

  describe('events', () => {
    it('should map to an action event handler', () => {
      const extractedArgType = extractArgTypes('sb-header');

      expect(extractedArgType?.onSbHeaderCreateAccount).toEqual({
        name: 'onSbHeaderCreateAccount',
        action: { name: 'sb-header:createAccount' },
        table: { disable: true },
      });
    });

    it('should map to a regular item', () => {
      const extractedArgType = extractArgTypes('sb-header');

      expect(extractedArgType?.['sb-header:createAccount']).toEqual({
        name: 'sb-header:createAccount',
        required: false,
        description: 'Event send when user clicks on create account button',
        type: { name: 'void' },
        table: {
          category: 'events',
          type: { summary: 'CustomEvent' },
          defaultValue: { summary: undefined },
        },
      });
    });
  });

  it('warns once for the web-component-analyzer shape', (): void => {
    const manifest = {
      version: 'experimental',
      tags: [
        {
          name: 'x-deprecated-shape',
          description: 'Legacy shape',
          attributes: [
            {
              name: 'label',
              description: 'Visible label',
              type: 'string',
            },
          ],
        },
      ],
    };
    const warn = vi.spyOn(logger, 'warn').mockImplementation((): void => {});

    const firstArgTypes = extractArgTypesFromElements('x-deprecated-shape', manifest);
    const secondArgTypes = extractArgTypesFromElements('x-deprecated-shape', manifest);

    expect(firstArgTypes).toMatchInlineSnapshot(`
      {
        "label": {
          "description": "Visible label",
          "name": "label",
          "required": false,
          "table": {
            "category": "attributes",
            "defaultValue": {
              "summary": undefined,
            },
            "type": {
              "summary": "string",
            },
          },
          "type": {
            "name": "string",
          },
        },
      }
    `);
    expect(secondArgTypes).toEqual(firstArgTypes);
    expect(warn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "The web-component-analyzer Custom Elements Manifest shape is deprecated and will be removed in Storybook 12. Generate a Custom Elements Manifest with @custom-elements-manifest/analyzer instead.",
        ],
      ]
    `);
  });
});
