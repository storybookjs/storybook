import { internal_UniversalStore } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';

import { globalSettings } from '../../cli/index.ts';
import {
  type ReviewHintStoreState,
  UNIVERSAL_REVIEW_HINT_STORE_OPTIONS,
} from '../../shared/review-hint-store/index.ts';

// Leads the review hint store: loads the dismissal from the user settings and saves it back, so a
// dismissal holds across projects and ports.
export async function initializeReviewHint() {
  try {
    const store = internal_UniversalStore.create<ReviewHintStoreState>({
      ...UNIVERSAL_REVIEW_HINT_STORE_OPTIONS,
      leader: true,
    });
    const settings = await globalSettings();
    store.setState({ dismissedAt: settings.value.reviewHint?.dismissedAt, loaded: true });

    store.onStateChange(({ dismissedAt }) => {
      // Anything on the channel can set the state. A value the settings schema rejects would make
      // the next start replace the whole settings file with defaults.
      const valid = dismissedAt === undefined || typeof dismissedAt === 'number';
      if (!valid || dismissedAt === settings.value.reviewHint?.dismissedAt) {
        return;
      }
      settings.value.reviewHint = { ...settings.value.reviewHint, dismissedAt };
      settings.save().catch((err) => {
        logger.debug(`Failed to save the review hint dismissal: ${err}`);
      });
    });
  } catch (err) {
    logger.debug(`Failed to initialize the review hint: ${err}`);
  }
}
