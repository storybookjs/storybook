// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOTIFIED_REVIEW_CREATED_AT_KEY,
  VISITED_REVIEW_CREATED_AT_KEY,
  reviewAvailableNotificationId,
} from './constants.ts';
import {
  acceptReviewNotification,
  claimNotificationSlot,
  clearReviewNotificationsOnDismiss,
  pickReviewToNotify,
  shouldAutoAcceptOnRoute,
  shouldSkipArrivalNotification,
} from './review-notification.ts';
import type { ReviewState } from './review-state.ts';
import { sessionStore } from './session-store.ts';

const review = (createdAt: number, title: string): ReviewState => ({
  title,
  description: '',
  createdAt,
  collections: [{ title: 'A', rationale: '', storyIds: ['s1'] }],
});

describe('pickReviewToNotify', () => {
  beforeEach(() => {
    sessionStore.remove(VISITED_REVIEW_CREATED_AT_KEY);
    sessionStore.remove(NOTIFIED_REVIEW_CREATED_AT_KEY);
  });

  it('prefers an unseen pending review', () => {
    expect(pickReviewToNotify(review(100, 'First'), review(200, 'Second'))).toEqual(
      review(200, 'Second')
    );
  });

  it('returns null when already accepted', () => {
    sessionStore.write(VISITED_REVIEW_CREATED_AT_KEY, '100');
    expect(pickReviewToNotify(review(100, 'First'), null)).toBeNull();
  });

  it('skips a stale displayed review after a newer one was accepted', () => {
    sessionStore.write(VISITED_REVIEW_CREATED_AT_KEY, '200');
    expect(pickReviewToNotify(review(100, 'First'), null)).toBeNull();
  });
});

describe('acceptReviewNotification', () => {
  beforeEach(() => {
    sessionStore.remove(VISITED_REVIEW_CREATED_AT_KEY);
    sessionStore.remove(NOTIFIED_REVIEW_CREATED_AT_KEY);
  });

  it('clears the notification and records acceptance', () => {
    const clearNotification = vi.fn();
    acceptReviewNotification({ clearNotification }, 100);
    expect(clearNotification).toHaveBeenCalledWith(reviewAvailableNotificationId(100));
    expect(sessionStore.read(VISITED_REVIEW_CREATED_AT_KEY)).toBe('100');
    expect(sessionStore.read(NOTIFIED_REVIEW_CREATED_AT_KEY)).toBe('100');
  });
});

describe('claimNotificationSlot', () => {
  beforeEach(() => {
    sessionStore.remove(VISITED_REVIEW_CREATED_AT_KEY);
    sessionStore.remove(NOTIFIED_REVIEW_CREATED_AT_KEY);
  });

  it('clears older notifications before claiming a new slot', () => {
    const clearNotification = vi.fn();
    expect(claimNotificationSlot({ clearNotification }, 200, 100)).toBe(true);
    expect(clearNotification).toHaveBeenCalledWith(reviewAvailableNotificationId(100));
    expect(claimNotificationSlot({ clearNotification }, 200)).toBe(false);
  });
});

describe('clearReviewNotificationsOnDismiss', () => {
  beforeEach(() => {
    sessionStore.remove(NOTIFIED_REVIEW_CREATED_AT_KEY);
    sessionStore.remove(VISITED_REVIEW_CREATED_AT_KEY);
    sessionStore.write(VISITED_REVIEW_CREATED_AT_KEY, '100');
  });

  it('clears notifications and the acceptance marker', () => {
    const clearNotification = vi.fn();
    clearReviewNotificationsOnDismiss({ clearNotification }, review(100, 'First'), null);
    expect(clearNotification).toHaveBeenCalledWith(reviewAvailableNotificationId(100));
    expect(sessionStore.read(VISITED_REVIEW_CREATED_AT_KEY)).toBeNull();
  });
});

describe('shouldSkipArrivalNotification', () => {
  it('skips deferred updates while already in review', () => {
    const displayed = review(100, 'First');
    const pending = review(200, 'Second');
    expect(shouldSkipArrivalNotification('/review/', undefined, pending, displayed, pending)).toBe(
      true
    );
    expect(
      shouldSkipArrivalNotification('/story/example--default', 0, pending, displayed, pending)
    ).toBe(true);
  });

  it('still notifies for unseen arrivals off review routes', () => {
    const displayed = review(100, 'First');
    const pending = review(200, 'Second');
    expect(
      shouldSkipArrivalNotification(
        '/story/example--default',
        undefined,
        pending,
        displayed,
        pending
      )
    ).toBe(false);
  });
});

describe('shouldAutoAcceptOnRoute', () => {
  beforeEach(() => {
    sessionStore.remove(VISITED_REVIEW_CREATED_AT_KEY);
    sessionStore.remove(NOTIFIED_REVIEW_CREATED_AT_KEY);
  });

  it('accepts on the review summary', () => {
    const displayed = review(200, 'Second');
    expect(shouldAutoAcceptOnRoute('/review/', undefined, displayed, displayed, null)).toBe(true);
  });

  it('skips while a deferred update is showing', () => {
    const displayed = review(100, 'First');
    const pending = review(200, 'Second');
    expect(shouldAutoAcceptOnRoute('/review/', undefined, pending, displayed, pending)).toBe(false);
  });
});
