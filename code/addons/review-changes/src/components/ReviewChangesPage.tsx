import { useEffect, useState } from 'react';

import { useChannel } from 'storybook/manager-api';

import { EVENTS } from '../constants.ts';
import type { ReviewState } from '../review-state.ts';
import { ReviewChangesScreen } from './ReviewChangesScreen.tsx';

// Container — wires the channel + manager api. The agent pushes a review via
// the MCP addon; we cache nothing here, just reflect the latest pushed state.
export const ReviewChangesPage: React.FC = () => {
  const [state, setState] = useState<ReviewState | null>(null);

  const emit = useChannel({
    [EVENTS.APPLY_REVIEW_STATE]: (next: ReviewState) => setState(next),
  });

  // Late/refreshed tab: ask the server to replay the cached overlay.
  useEffect(() => {
    emit(EVENTS.REQUEST_REVIEW_STATE);
  }, [emit]);

  return <ReviewChangesScreen state={state} />;
};
