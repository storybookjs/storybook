import * as REACT from 'react';
import * as REACT_ARIA_FOCUS_SCOPE from '@storybook/ui/internal/deep/components/focus-scope';
import * as REACT_DOM from 'react-dom';
import * as REACT_DOM_CLIENT from 'react-dom/client';
import * as REACT_JSX_RUNTIME from 'react/jsx-runtime';

import * as CHANNELS from '@storybook/core/internal/channels';
import * as CLIENT_LOGGER from '@storybook/core/internal/client-logger';
import * as COMPONENTS from '@storybook/ui/internal/components';
import * as EVENTS from '@storybook/core/internal/core-events';
import * as EVENTS_MANAGER_ERRORS from '@storybook/core/internal/manager-errors';
import * as ROUTER from '@storybook/manager/internal/router';
import * as TYPES from '@storybook/core/internal/types';

import * as ICONS from '@storybook/icons';

import * as MANAGER_API from '@storybook/manager/manager-api';
import * as TEST from '@storybook/core/test';
import * as THEMING from '@storybook/ui/theming';
import * as THEMINGCREATE from '@storybook/ui/theming/create';

import type { globalsNameReferenceMap } from './globals.ts';

// Here we map the name of a module to their VALUE in the global scope.
export const globalsNameValueMap: Required<Record<keyof typeof globalsNameReferenceMap, any>> = {
  react: REACT,
  'react/jsx-runtime': REACT_JSX_RUNTIME,
  // The manager uses production React, whose development runtime does not provide jsxDEV.
  'react/jsx-dev-runtime': {
    Fragment: REACT_JSX_RUNTIME.Fragment,
    jsxDEV: REACT_JSX_RUNTIME.jsx,
  },
  'react-dom': REACT_DOM,
  'react-dom/client': REACT_DOM_CLIENT,
  'react-aria/FocusScope': REACT_ARIA_FOCUS_SCOPE,
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
  'storybook/internal/router': ROUTER,
  'storybook/internal/types': TYPES,
};
