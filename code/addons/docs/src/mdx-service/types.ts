import type { MdxPayload } from 'storybook/internal/core-server';
import type { DocsIndexEntry } from 'storybook/internal/types';

export interface MdxProviderInput {
  componentId: string;
  entries: DocsIndexEntry[];
}

export type MdxProvider = (input: MdxProviderInput) => Promise<MdxPayload | undefined>;
