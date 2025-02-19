import * as CHANNELS from 'storybook/internal/channels';
import * as CLIENT_LOGGER from 'storybook/internal/client-logger';
import * as CORE_EVENTS from 'storybook/internal/core-events';
import * as PREVIEW_API from 'storybook/internal/preview-api';
import * as CORE_EVENTS_PREVIEW_ERRORS from 'storybook/internal/preview-errors';
import * as TYPES from 'storybook/internal/types';

import * as GLOBAL from '@storybook/global';

import type { globalsNameReferenceMap } from './globals';

// Here we map the name of a module to their VALUE in the global scope.
export const globalsNameValueMap: Required<Record<keyof typeof globalsNameReferenceMap, any>> = {
  '@storybook/global': GLOBAL,

  'storybook/internal/channels': CHANNELS,
  '@storybook/channels': CHANNELS,

  'storybook/internal/client-logger': CLIENT_LOGGER,
  '@storybook/client-logger': CLIENT_LOGGER,

  'storybook/internal/core-events': CORE_EVENTS,
  '@storybook/core-events': CORE_EVENTS,

  'storybook/internal/preview-errors': CORE_EVENTS_PREVIEW_ERRORS,
  '@storybook/core-events/preview-errors': CORE_EVENTS_PREVIEW_ERRORS,

  'storybook/internal/preview-api': PREVIEW_API,
  '@storybook/preview-api': PREVIEW_API,

  'storybook/internal/types': TYPES,
  '@storybook/types': TYPES,
};
