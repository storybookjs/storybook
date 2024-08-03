import * as REACT from 'react';
import * as REACT_DOM from 'react-dom';
import * as REACT_DOM_CLIENT from 'react-dom/client';

import * as COMPONENTS from '@storybook/core/components';
import * as ICONS from '@storybook/icons';
import * as MANAGER_API from '@storybook/core/manager-api';

import * as CHANNELS from '@storybook/core/channels';
import * as EVENTS from '@storybook/core/core-events';
import * as EVENTS_MANAGER_ERRORS from '@storybook/core/manager-errors';
import * as ROUTER from '@storybook/core/router';
import * as THEMING from '@storybook/core/theming';
import * as THEMINGCREATE from '@storybook/core/theming/create';
import * as TYPES from '@storybook/core/types';
import * as CLIENT_LOGGER from '@storybook/core/client-logger';

import type { globalsNameReferenceMap } from './globals';

// Here we map the name of a module to their VALUE in the global scope.
export const globalsNameValueMap: Required<Record<keyof typeof globalsNameReferenceMap, any>> = {
  react: REACT,
  'react-dom': REACT_DOM,
  'react-dom/client': REACT_DOM_CLIENT,
  '@storybook/icons': ICONS,

  'storybook/internal/components': COMPONENTS,
  '@storybook/components': COMPONENTS,
  '@storybook/core/components': COMPONENTS,

  'storybook/internal/manager-api': MANAGER_API,
  '@storybook/manager-api': MANAGER_API,
  '@storybook/core/manager-api': MANAGER_API,

  'storybook/internal/router': ROUTER,
  '@storybook/router': ROUTER,
  '@storybook/core/router': ROUTER,

  'storybook/internal/theming': THEMING,
  '@storybook/theming': THEMING,
  '@storybook/core/theming': THEMING,
  'storybook/internal/theming/create': THEMINGCREATE,
  '@storybook/theming/create': THEMINGCREATE,
  '@storybook/core/theming/create': THEMINGCREATE,

  'storybook/internal/channels': CHANNELS,
  '@storybook/channels': CHANNELS,
  '@storybook/core/channels': CHANNELS,

  'storybook/internal/core-errors': EVENTS,
  '@storybook/core-events': EVENTS,
  '@storybook/core/core-events': EVENTS,

  'storybook/internal/types': TYPES,
  '@storybook/types': TYPES,
  '@storybook/core/types': TYPES,

  'storybook/internal/manager-errors': EVENTS_MANAGER_ERRORS,
  '@storybook/core-events/manager-errors': EVENTS_MANAGER_ERRORS,
  '@storybook/core/manager-errors': EVENTS_MANAGER_ERRORS,

  'storybook/internal/client-logger': CLIENT_LOGGER,
  '@storybook/client-logger': CLIENT_LOGGER,
  '@storybook/core/client-logger': CLIENT_LOGGER,
};
