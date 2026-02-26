import type { Channel } from 'storybook/internal/channels';
import {
  PLAY_FUNCTION_THREW_EXCEPTION,
  RUN_SESSION_REGISTER,
  STORY_ERRORED,
  STORY_FINISHED,
  STORY_MISSING,
  STORY_THREW_EXCEPTION,
} from 'storybook/internal/core-events';

import type { StoryResult } from '../utils/run-reporter';

interface PendingStoryWait {
  storyId: string;
  resolver: (result: StoryResult) => void;
}

/**
 * Manages story result communication via the preview channel. Uses runSessionId + storyId as
 * isolation keys to prevent cross-story contamination.
 */
export class RunStoryChannel {
  private registeredSessions: Set<string> = new Set();
  private pendingResolvers: Map<string, PendingStoryWait> = new Map();
  private channel: Channel;

  constructor(channel: Channel) {
    this.channel = channel;

    // Register session when preview connects
    this.channel.on(RUN_SESSION_REGISTER, (args: { runSessionId: string }) => {
      this.registeredSessions.add(args.runSessionId);
    });

    // Terminal events that conclude a story run
    const terminalEvents = [
      STORY_FINISHED,
      STORY_THREW_EXCEPTION,
      PLAY_FUNCTION_THREW_EXCEPTION,
      STORY_ERRORED,
      STORY_MISSING,
    ];

    terminalEvents.forEach((event) => {
      this.channel.on(event, (args: any) => {
        // Resolve only if there's a pending wait for this story and session
        for (const [runSessionId, wait] of this.pendingResolvers.entries()) {
          if (this.registeredSessions.has(runSessionId) && args?.storyId === wait.storyId) {
            const result = this.toStoryResult(event, args);
            wait.resolver(result);
            this.pendingResolvers.delete(runSessionId);
            this.registeredSessions.delete(runSessionId);
            break;
          }
        }
      });
    });
  }

  /**
   * Wait for a specific story to finish, returns a promise that resolves with the story result.
   *
   * @param storyId The ID of the story being executed
   * @param runSessionId Unique session identifier for this run
   */
  waitForStory(storyId: string, runSessionId: string): Promise<StoryResult> {
    return new Promise<StoryResult>((resolve) => {
      this.pendingResolvers.set(runSessionId, { storyId, resolver: resolve });
    });
  }

  /**
   * Cancel and clean up a pending story wait. Called when a story times out or is interrupted.
   *
   * @param runSessionId Unique session identifier
   * @param storyId The ID of the story
   */
  cancelWait(runSessionId: string, storyId: string): void {
    const wait = this.pendingResolvers.get(runSessionId);
    if (wait && wait.storyId === storyId) {
      this.pendingResolvers.delete(runSessionId);
    }
  }

  /**
   * Convert a channel event and its args into a StoryResult.
   *
   * @param event The event name
   * @param args The event arguments from the channel
   */
  private toStoryResult(event: string, args: any): StoryResult {
    // Success case: story finished without errors
    if (event === STORY_FINISHED && args?.status === 'success') {
      return {
        id: args?.storyId ?? 'unknown',
        status: 'passed',
      };
    }

    // Extract error message and stack from various possible sources
    const errorMessage = args?.error?.message ?? args?.message ?? 'Unknown error';
    const stackTrace = args?.error?.stack ?? args?.stack ?? '';

    return {
      id: args?.storyId ?? 'unknown',
      status: 'failed',
      error: errorMessage,
      stacktrace: stackTrace,
    };
  }
}
