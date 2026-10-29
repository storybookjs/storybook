import '../../storybook/server/hooks.ts';

import type { Storybook } from '@storybook/core';
import type { Channel } from '@storybook/core/internal/channels';
import { registerToolset } from '@storybook/core/open-service';
import { telemetry } from '@storybook/core/internal/telemetry';
import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';
import { getDevServerSubscriptions } from '@storybook/core/internal/deep/services/dev-server-subscriptions';
import {
  REVIEW_EVENTS,
  type ReviewPageviewPayload,
} from '@storybook/core/internal/deep/shared/review/events';

import { packageEntry } from '../entries.ts';
import { registerReviewService, subscribeReviewToModuleGraphChanges } from './server.ts';
import { reviewToolset } from './toolset.ts';

/** Register the review service and toolset; reviews go stale on graph changes once a dev server runs. */
export function registerReview(storybook: Pick<Storybook, 'getIndex'>): void {
  registerReviewService({ getIndex: () => storybook.getIndex() });
  getDevServerSubscriptions().push(subscribeReviewToModuleGraphChanges);
  registerToolset(reviewToolset);
}

/** Record review page views the manager reports. */
export function initReviewTelemetry(channel: Channel): void {
  channel.on(REVIEW_EVENTS.PAGEVIEW, ({ page, reviewCreatedAt }: ReviewPageviewPayload) => {
    // Reviews are only produced by the MCP review-create tool today; other
    // producers should report their own `source` under the same event.
    telemetry('review', { action: 'pageview', source: 'mcp-review', page, reviewCreatedAt });
  });
}

/** The review page: its service, toolset, manager entry, and page-view telemetry. */
export default defineAddon(() => ({
  meta: { name: 'storybook/review', order: 1 },
  manager: packageEntry('@storybook/manager', 'shared/open-service/services/review/manager.js'),
  setup(storybook): void {
    storybook.hook('core:services:register', () => registerReview(storybook));
    storybook.hook('server:channel:ready', (channel) => initReviewTelemetry(channel));
  },
}));
