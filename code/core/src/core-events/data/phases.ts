import type { Report } from 'storybook/preview-api';

export interface StoryRenderPhaseChangedPayload {
  storyId: string;
  renderId: number;
  newPhase: string;
  renderContext?: unknown;
  reason?: 'unchanged' | 'aborted' | 'superseded';
}

export interface StoryFinishedPayload {
  storyId: string;
  status: 'error' | 'success';
  reporters: Report[];
  renderId?: number;
  renderContext?: unknown;
}
