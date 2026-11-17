import type { StrictArgTypes } from '../../../../../core/src/csf/story.ts';

import type { StorySource } from './story-source.ts';

export interface CapturedComponent {
  id: string;
  name: string;
  description?: string;
  argTypes: StrictArgTypes;
  stories: Record<string, { snippet: string | null; source?: StorySource }>;
}
export type CapturedComponents = Record<string, CapturedComponent>;
export interface CaptureMetadata {
  engine: 'legacy' | 'server';
  storybookVersion: string;
  repo: string;
  sha: string;
  capturedAt: string;
}
