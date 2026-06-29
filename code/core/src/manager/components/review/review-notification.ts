import type { API } from 'storybook/manager-api';

import {
  NOTIFIED_REVIEW_CREATED_AT_KEY,
  REVIEW_AVAILABLE_NOTIFICATION_ID,
  VISITED_REVIEW_CREATED_AT_KEY,
  reviewAvailableNotificationId,
} from './constants.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  isReviewSummaryPath,
  parseCollectionIndex,
} from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';
import { sessionStore } from './session-store.ts';

const isUnseen = (createdAt: number | undefined): boolean =>
  createdAt !== undefined && sessionStore.read(VISITED_REVIEW_CREATED_AT_KEY) !== String(createdAt);

const readVisitedCreatedAt = (): number | undefined => {
  const raw = sessionStore.read(VISITED_REVIEW_CREATED_AT_KEY);
  if (raw === null) {
    return undefined;
  }
  const visited = Number(raw);
  return Number.isFinite(visited) ? visited : undefined;
};

/** True when the user already opened a newer review push. */
const isSupersededByVisit = (createdAt: number | undefined): boolean => {
  const visited = readVisitedCreatedAt();
  return createdAt !== undefined && visited !== undefined && visited > createdAt;
};

const readNotifiedCreatedAt = (): number | undefined => {
  const raw = sessionStore.read(NOTIFIED_REVIEW_CREATED_AT_KEY);
  if (raw === null) {
    return undefined;
  }
  const notified = Number(raw);
  return Number.isFinite(notified) ? notified : undefined;
};

export const pickReviewToNotify = (
  displayed: ReviewState | null,
  deferred: ReviewState | null
): ReviewState | null => {
  if (deferred?.createdAt !== undefined && isUnseen(deferred.createdAt)) {
    return deferred;
  }
  if (
    displayed?.createdAt !== undefined &&
    isUnseen(displayed.createdAt) &&
    !isSupersededByVisit(displayed.createdAt)
  ) {
    return displayed;
  }
  return null;
};

/** User opened the displayed review (summary or review story with collection param). */
export const shouldAutoAcceptOnRoute = (
  path: string,
  collectionIndex: number | undefined,
  candidate: ReviewState,
  displayed: ReviewState | null,
  deferred: ReviewState | null
): boolean => {
  const createdAt = candidate.createdAt;
  if (createdAt === undefined || !isUnseen(createdAt) || displayed?.createdAt !== createdAt) {
    return false;
  }
  const onReviewRoute =
    isReviewSummaryPath(path) || (path.startsWith('/story/') && collectionIndex !== undefined);
  if (!onReviewRoute) {
    return false;
  }
  if (deferred?.createdAt !== undefined && deferred.createdAt !== displayed.createdAt) {
    return false;
  }
  return true;
};

export const clearReviewNotifications = (
  api: Pick<API, 'clearNotification'>,
  ...createdAts: Array<number | null | undefined>
): void => {
  for (const createdAt of new Set(
    createdAts.filter((value): value is number => value !== undefined && value !== null)
  )) {
    api.clearNotification(reviewAvailableNotificationId(createdAt));
  }
  api.clearNotification(REVIEW_AVAILABLE_NOTIFICATION_ID);
};

export const acceptReviewNotification = (
  api: Pick<API, 'clearNotification'>,
  createdAt: number | undefined
): void => {
  if (createdAt === undefined) {
    return;
  }
  clearReviewNotifications(api, createdAt);
  sessionStore.write(VISITED_REVIEW_CREATED_AT_KEY, String(createdAt));
  // Mark notified too so a layout-effect re-run cannot re-post the arrival toast.
  sessionStore.write(NOTIFIED_REVIEW_CREATED_AT_KEY, String(createdAt));
};

export const clearReviewNotificationsOnDismiss = (
  api: Pick<API, 'clearNotification'>,
  displayed: ReviewState | null | undefined,
  deferred: ReviewState | null | undefined
): void => {
  clearReviewNotifications(api, displayed?.createdAt, deferred?.createdAt, readNotifiedCreatedAt());
  sessionStore.remove(VISITED_REVIEW_CREATED_AT_KEY);
  sessionStore.remove(NOTIFIED_REVIEW_CREATED_AT_KEY);
};

export const claimNotificationSlot = (
  api: Pick<API, 'clearNotification'>,
  createdAt: number,
  ...extraCreatedAts: Array<number | null | undefined>
): boolean => {
  if (!isUnseen(createdAt) || readNotifiedCreatedAt() === createdAt) {
    return false;
  }
  clearReviewNotifications(api, readNotifiedCreatedAt(), ...extraCreatedAts);
  sessionStore.write(NOTIFIED_REVIEW_CREATED_AT_KEY, String(createdAt));
  return true;
};

export const readCollectionIndex = (
  queryParams: Record<string, unknown> | undefined
): number | undefined =>
  parseCollectionIndex(queryParams?.[REVIEW_COLLECTION_QUERY_PARAM] as string | undefined);
