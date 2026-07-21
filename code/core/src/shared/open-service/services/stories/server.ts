import { registerService } from '../../server.ts';
import { storiesServiceDef } from './definition.ts';

/**
 * Registers the `core/stories` open service.
 * Command handlers are supplied by the caller (typically core-server).
 */
export function registerStoriesService(registration?: Parameters<typeof registerService>[1]) {
  return registerService(storiesServiceDef, registration);
}
