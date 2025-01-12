import type { Report } from '../../preview-api';

export interface StoryFinishedPayload {
  storyId: string;
  status: 'error' | 'success';
  reporters: Report[];
}
