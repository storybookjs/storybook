import type { BinaryLike } from 'crypto';
import { createHash } from 'crypto';

export const oneWayHash = (payload: BinaryLike): string => {
  const hash = createHash('sha256');

  // Always prepend the payload value with salt. This ensures the hash is truly
  // one-way.
  hash.update('storybook-telemetry-salt');

  // Update is an append operation, not a replacement. The salt from the prior
  // update is still present!
  hash.update(payload);
  return hash.digest('hex');
};
