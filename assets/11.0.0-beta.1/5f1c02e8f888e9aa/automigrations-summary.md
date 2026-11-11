# Automigrations summary

These files could not be migrated automatically.
Update them by hand.
A section disappears once its migration runs again without failures.
Delete this file when you are done.

## argtypes-default-value

| File | Reason |
| ---- | ------ |
| `packages/ui/src/form/searchable-chip-select-control/stories/index.story.tsx` | line 61: Cannot mutate argTypes because the target contains spread field |
| `packages/ui/src/form/searchable-select-control/stories/index.story.tsx` | line 60: Cannot mutate argTypes because the target contains spread field |

## story-sort-to-main

| File | Reason |
| ---- | ------ |
| `storybook/main.ts` | Cannot automigrate storySort: storySort must be a statically readable object or array. Storybook no longer reads parameters.options.storySort from the preview. Move it to storySorts in the main config manually and remove the preview property. |
