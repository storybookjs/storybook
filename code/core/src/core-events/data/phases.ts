import type { Report } from '@storybook/core/preview-api';

export interface StoryFinishedPayload {
  storyId: string;
  status: 'error' | 'success';
  reporters: Report[];
}
