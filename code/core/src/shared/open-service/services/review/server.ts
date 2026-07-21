import { registerService } from '../../server.ts';
import { reviewServiceDef } from './definition.ts';

/**
 * Registers the `core/review` open service.
 * Command handlers are supplied by the caller (typically addon-mcp).
 */
export function registerReviewService(registration?: Parameters<typeof registerService>[1]) {
  return registerService(reviewServiceDef, registration);
}
