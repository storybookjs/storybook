import { registerService } from '../../server.ts';
import { testServiceDef } from './definition.ts';

/**
 * Registers the `core/test` open service.
 * Command handlers are supplied by the caller (typically addon-vitest).
 */
export function registerTestService(registration?: Parameters<typeof registerService>[1]) {
  return registerService(testServiceDef, registration);
}
