import { registerService } from '../../server.ts';
import { reviewServiceDef } from './definition.ts';

/** Registers the stateful `core/review` service in the server realm. */
export function registerReviewService() {
  return registerService(reviewServiceDef);
}
