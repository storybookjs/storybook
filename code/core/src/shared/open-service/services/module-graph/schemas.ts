import * as v from 'valibot';

export const storyIndexPathSchema = v.pipe(
  v.string(),
  v.description('A story-index-style relative path such as `./src/Button.stories.tsx`.')
);

export const storyDependencyDepthSchema = v.pipe(
  v.number(),
  v.description(
    'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
  )
);

export const storiesByFileSchema = v.record(
  storyIndexPathSchema,
  v.record(storyIndexPathSchema, storyDependencyDepthSchema)
);

export const storiesForFilesInputSchema = v.object({
  files: v.pipe(
    v.array(
      v.pipe(
        v.string(),
        v.description(
          'Input source file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
        )
      )
    ),
    v.description('Source files to look up. Output arrays match this input order.')
  ),
});

export const storiesForFilesOutputSchema = v.array(
  v.array(
    v.object({
      storyFile: v.pipe(
        storyIndexPathSchema,
        v.description(
          'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
        )
      ),
      depth: storyDependencyDepthSchema,
    })
  )
);
