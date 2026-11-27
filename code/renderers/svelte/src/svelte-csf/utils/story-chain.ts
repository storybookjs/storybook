// The export name of the story that each story extends, by its own export name.
export type StoryParents = Map<string, string>;

// The export names of a story and of the stories it extends, nearest first. A cycle ends the chain
// before it repeats a story.
export function getStoryChain(parents: StoryParents, exportName: string): string[] {
  const chain = [exportName];
  for (let parent = parents.get(exportName); parent; parent = parents.get(parent)) {
    if (chain.includes(parent)) {
      break;
    }
    chain.push(parent);
  }
  return chain;
}
