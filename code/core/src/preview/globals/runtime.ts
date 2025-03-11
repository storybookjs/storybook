import * as CHANNELS from 'storybook/internal/channels';
import * as CLIENT_LOGGER from 'storybook/internal/client-logger';
import * as CORE_EVENTS from 'storybook/internal/core-events';
import * as CORE_EVENTS_PREVIEW_ERRORS from 'storybook/internal/preview-errors';
import * as TYPES from 'storybook/internal/types';

import * as GLOBAL from '@storybook/global';

import * as ACTIONS from 'storybook/actions';
import * as ACTIONS_DECORATOR from 'storybook/actions/decorator';
import * as ACTIONS_MANAGER from 'storybook/actions/manager';
import * as ACTIONS_PREVIEW from 'storybook/actions/preview';
import * as PREVIEW_API from 'storybook/preview-api';
import * as TEST from 'storybook/test';

import type { globalsNameReferenceMap } from './globals';

// Here we map the name of a module to their VALUE in the global scope.
export const globalsNameValueMap: Required<Record<keyof typeof globalsNameReferenceMap, any>> = {
  '@storybook/global': GLOBAL,

  'storybook/internal/channels': CHANNELS,

  'storybook/internal/client-logger': CLIENT_LOGGER,

  'storybook/internal/core-events': CORE_EVENTS,

  'storybook/internal/preview-errors': CORE_EVENTS_PREVIEW_ERRORS,

  'storybook/preview-api': PREVIEW_API,

  'storybook/test': TEST,

  'storybook/actions': ACTIONS,
  'storybook/actions/preview': ACTIONS_PREVIEW,
  'storybook/actions/manager': ACTIONS_MANAGER,
  'storybook/actions/decorator': ACTIONS_DECORATOR,

  'storybook/internal/types': TYPES,
};
