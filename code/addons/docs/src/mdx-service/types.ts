import type { MdxPayload } from '@storybook/core/internal/story-index';
import type { DocsIndexEntry } from '@storybook/core/internal/types';

export interface MdxProviderInput {
  componentId: string;
  entries: DocsIndexEntry[];
}

export type MdxProvider = (input: MdxProviderInput) => Promise<MdxPayload | undefined>;
