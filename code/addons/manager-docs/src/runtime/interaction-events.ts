import {
  PLAY_FUNCTION_THREW_EXCEPTION,
  STORY_RENDER_PHASE_CHANGED,
  STORY_THREW_EXCEPTION,
  UNHANDLED_ERRORS_WHILE_PLAYING,
} from 'storybook/internal/core-events';

import { EVENTS } from '../../../../core/src/instrumenter/EVENTS.ts';

/**
 * Preview events the Interactions panel reads. A docs iframe re-sends each one addressed to its
 * own instance.
 */
export const FORWARDED_INTERACTION_EVENTS: readonly string[] = [
  EVENTS.CALL,
  EVENTS.SYNC,
  STORY_RENDER_PHASE_CHANGED,
  STORY_THREW_EXCEPTION,
  PLAY_FUNCTION_THREW_EXCEPTION,
  UNHANDLED_ERRORS_WHILE_PLAYING,
];

/**
 * Instrumenter debugger events a docs canvas may send to its own iframe.
 */
export const DEBUGGER_EVENTS: readonly string[] = [
  EVENTS.START,
  EVENTS.BACK,
  EVENTS.GOTO,
  EVENTS.NEXT,
  EVENTS.END,
];
