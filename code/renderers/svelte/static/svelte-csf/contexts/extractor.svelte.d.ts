import type {
  Cmp,
  StoriesExtractorContext,
  StoriesRepository,
} from '../../../src/svelte-csf/types.ts';

export declare function createStoriesExtractorContext<TCmp extends Cmp>(
  repository: StoriesRepository<TCmp>
): void;

export declare function useStoriesExtractor<TCmp extends Cmp>(): StoriesExtractorContext<TCmp>;
