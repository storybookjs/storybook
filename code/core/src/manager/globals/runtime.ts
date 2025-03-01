import * as REACT from 'react';
import * as REACT_DOM from 'react-dom';
import * as REACT_DOM_CLIENT from 'react-dom/client';

import * as CHANNELS from 'storybook/internal/channels';
import * as CLIENT_LOGGER from 'storybook/internal/client-logger';
import * as COMPONENTS from 'storybook/internal/components';
import * as EVENTS from 'storybook/internal/core-events';
import * as MANAGER_API from 'storybook/internal/manager-api';
import * as EVENTS_MANAGER_ERRORS from 'storybook/internal/manager-errors';
import * as ROUTER from 'storybook/internal/router';
import * as THEMING from 'storybook/internal/theming';
import * as THEMINGCREATE from 'storybook/internal/theming/create';
import * as TYPES from 'storybook/internal/types';

import * as ICONS from '@storybook/icons';

import type { globalsNameReferenceMap } from './globals';

// Here we map the name of a module to their VALUE in the global scope.
export const globalsNameValueMap: Required<Record<keyof typeof globalsNameReferenceMap, any>> = {
  react: REACT,
  'react-dom': REACT_DOM,
  'react-dom/client': REACT_DOM_CLIENT,
  '@storybook/icons': ICONS,

  'storybook/internal/components': COMPONENTS,

  'storybook/internal/manager-api': MANAGER_API,

  'storybook/internal/router': ROUTER,
  '@storybook/router': ROUTER,

  'storybook/internal/theming': THEMING,
  'storybook/internal/theming/create': THEMINGCREATE,

  'storybook/internal/channels': CHANNELS,

  'storybook/internal/core-errors': EVENTS,
  'storybook/internal/core-events': EVENTS,

  'storybook/internal/types': TYPES,

  'storybook/internal/manager-errors': EVENTS_MANAGER_ERRORS,

  'storybook/internal/client-logger': CLIENT_LOGGER,
};
