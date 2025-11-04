import * as REACT from 'react';
import * as REACT_DOM from 'react-dom';
import * as REACT_DOM_CLIENT from 'react-dom/client';

import * as CHANNELS from 'storybook/internal/channels';
import * as CLIENT_LOGGER from 'storybook/internal/client-logger';
import * as COMPONENTS from 'storybook/internal/components';
import * as EVENTS from 'storybook/internal/core-events';
import * as EVENTS_MANAGER_ERRORS from 'storybook/internal/manager-errors';
import * as MANAGER_STORES from 'storybook/internal/manager/manager-stores';
import * as ROUTER from 'storybook/internal/router';
import * as TYPES from 'storybook/internal/types';

import * as ICONS from '@storybook/icons';

import * as MANAGER_API from 'storybook/manager-api';
import * as TEST from 'storybook/test';
import * as THEMING from 'storybook/theming';
import * as THEMINGCREATE from 'storybook/theming/create';

import type { globalsNameReferenceMap } from './globals';

// Here we map the name of a module to their VALUE in the global scope.
export const globalsNameValueMap: Required<Record<keyof typeof globalsNameReferenceMap, any>> = {
  react: REACT,
  'react-dom': REACT_DOM,
  'react-dom/client': REACT_DOM_CLIENT,
  '@storybook/icons': ICONS,

  'storybook/manager-api': MANAGER_API,

  'storybook/theming': THEMING,
  'storybook/theming/create': THEMINGCREATE,

  'storybook/test': TEST,

  'storybook/internal/channels': CHANNELS,
  'storybook/internal/client-logger': CLIENT_LOGGER,
  'storybook/internal/components': COMPONENTS,
  'storybook/internal/core-events': EVENTS,
  'storybook/internal/manager-errors': EVENTS_MANAGER_ERRORS,
  'storybook/internal/manager/manager-stores': MANAGER_STORES,
  'storybook/internal/router': ROUTER,
  'storybook/internal/types': TYPES,
};
