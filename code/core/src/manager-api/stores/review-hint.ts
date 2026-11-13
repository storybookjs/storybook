import {
  type ReviewHintStoreState,
  UNIVERSAL_REVIEW_HINT_STORE_OPTIONS,
} from '../../shared/review-hint-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';

// A static build has no server to lead this store, and shows no review hint.
export const universalReviewHintStore = UniversalStore.create<ReviewHintStoreState>({
  ...UNIVERSAL_REVIEW_HINT_STORE_OPTIONS,
  leader: globalThis.CONFIG_TYPE === 'PRODUCTION',
});
