/* eslint-disable @typescript-eslint/no-namespace */
// ***********************************************************
// This example support/component.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

import { mount } from 'cypress/vue'

import type { ProjectAnnotations } from 'storybook/internal/types';
import { VueRenderer, setProjectAnnotations } from '@storybook/vue3';
import sbAnnotations from '../../.storybook/preview';
import * as addonInteractions from '@storybook/addon-interactions/preview';
import * as addonActions from '@storybook/addon-essentials/actions/preview';


// Augment the Cypress namespace to include type definitions for
// your custom command.
// Alternatively, can be defined in cypress/support/component.d.ts
// with a <reference path="./component" /> at the top of your spec.
declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
    }
  }
}

Cypress.Commands.add('mount', mount)

// This is needed because Cypress defines process but not process.env
// And if the play function fails, testing library's internals have a check
// for typeof process !== "undefined" && process.env.DEBUG_PRINT_LIMIT;
// which will break
process.env = {};

setProjectAnnotations([
  sbAnnotations,
  addonInteractions as ProjectAnnotations<VueRenderer>, // instruments actions as spies
  addonActions as ProjectAnnotations<VueRenderer>, // creates actions from argTypes
]);
