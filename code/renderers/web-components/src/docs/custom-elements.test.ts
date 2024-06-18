// @vitest-environment happy-dom

/* eslint-disable no-underscore-dangle */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { global } from '@storybook/global';
import { extractArgTypes } from './custom-elements';
import customElementsManifest from './__testfixtures__/custom-elements.json';

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
