import { definePreviewAddon } from 'storybook/internal/csf';

import { parameters } from './preview.ts';

export type { DocsPage, Block, Inline } from './parser/types.ts';
export { ManagerDocsParseError } from './errors.ts';
export { parseManagerDocs } from './parser/parse-mdx.ts';
export type { DocsArticleModel, StoryInstance } from './runtime/page-model.ts';
export { createArticleModel } from './runtime/page-model.ts';
export type { ChannelState, InstanceEvent, RouteDecision } from './runtime/channel-router.ts';
export {
  createChannelState,
  dispatchInstanceEvent,
  registerInstance,
} from './runtime/channel-router.ts';
export type { PlayEffect, SchedulerState } from './runtime/play-scheduler.ts';
export { completePlay, createPlayScheduler, enqueuePlays } from './runtime/play-scheduler.ts';
export type { IframeHost, IframeSession } from './runtime/iframe-session.ts';
export {
  applySessionEvent,
  createIframeHost,
  mountInstance,
  resetSession,
  reuseInstance,
} from './runtime/iframe-session.ts';

export default () => definePreviewAddon({ parameters });
