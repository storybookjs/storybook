import type { Report } from 'storybook/internal/preview-api';

export interface StoryFinishedPayload {
  storyId: string;
  status: 'error' | 'success';
  reporters: Report[];
}
