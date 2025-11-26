import type { Report } from 'storybook/preview-api';

export interface StoryFinishedPayload {
  storyId: string;
  status: 'error' | 'success';
  reporters: Report[];
}
