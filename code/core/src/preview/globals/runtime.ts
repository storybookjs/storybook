import * as GLOBAL from '@storybook/global';

import * as CHANNELS from '@storybook/core/channels';
import * as CLIENT_LOGGER from '@storybook/core/client-logger';
import * as CORE_EVENTS from '@storybook/core/core-events';
import * as CORE_EVENTS_PREVIEW_ERRORS from '@storybook/core/preview-errors';
import * as PREVIEW_API from '@storybook/core/preview-api';
import * as TYPES from '@storybook/core/types';

import type { globalsNameReferenceMap } from './globals';

// Here we map the name of a module to their VALUE in the global scope.
export const globalsNameValueMap: Required<Record<keyof typeof globalsNameReferenceMap, any>> = {
  '@storybook/global': GLOBAL,

  'storybook/internal/channels': CHANNELS,
  '@storybook/channels': CHANNELS,
  '@storybook/core/channels': CHANNELS,

  'storybook/internal/client-logger': CLIENT_LOGGER,
  '@storybook/client-logger': CLIENT_LOGGER,
  '@storybook/core/client-logger': CLIENT_LOGGER,

  'storybook/internal/core-events': CORE_EVENTS,
  '@storybook/core-events': CORE_EVENTS,
  '@storybook/core/core-events': CORE_EVENTS,

  'storybook/internal/preview-errors': CORE_EVENTS_PREVIEW_ERRORS,
  '@storybook/core-events/preview-errors': CORE_EVENTS_PREVIEW_ERRORS,
  '@storybook/core/preview-errors': CORE_EVENTS_PREVIEW_ERRORS,

  'storybook/internal/preview-api': PREVIEW_API,
  '@storybook/preview-api': PREVIEW_API,
  '@storybook/core/preview-api': PREVIEW_API,

  'storybook/internal/types': TYPES,
  '@storybook/types': TYPES,
  '@storybook/core/types': TYPES,
};
