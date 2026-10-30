import type { Story as CsfFactoryStory } from 'storybook/internal/csf';
import type { AnnotatedStoryFn, Renderer, StoryAnnotations } from 'storybook/internal/types';
type ManagerDocsStoryReference =
  | StoryAnnotations<Renderer>
  | AnnotatedStoryFn<Renderer>
  | CsfFactoryStory<Renderer>;

export type ManagerDocsStoryProps = {
  of: ManagerDocsStoryReference;
  focus?: boolean;
  height?: 'auto' | '100vh' | number;
  /**
   * Aspect ratio such as "16/9" or a positive decimal. The manager-docs parser is the authority for the pattern.
   */
  ratio?: string;
  /** Omitted or `true` shows the manager toolbar above this frame. `false` or `[]` hides it. */
  toolbar?: boolean | readonly [];
  panel?: boolean | readonly ('actions' | 'interactions')[];
};

/**
 * Marks a story frame in manager-docs MDX.
 *
 * @throws When a compiler evaluates this module outside manager-docs.
 */
export function Story(_props: ManagerDocsStoryProps): never {
  throw new Error('<Alias.Story> is only valid in manager-docs MDX');
}
