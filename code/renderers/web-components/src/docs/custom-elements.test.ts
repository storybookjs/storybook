// @vitest-environment happy-dom

/* eslint-disable no-underscore-dangle */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { global } from '@storybook/global';

import customElementsManifest from './__testfixtures__/custom-elements.json';
import { extractArgTypes } from './custom-elements';

const { window } = global;

describe('extractArgTypes', () => {
  beforeEach(() => {
    window.__STORYBOOK_CUSTOM_ELEMENTS_MANIFEST__ = customElementsManifest;
  });

  afterEach(() => {
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
});
