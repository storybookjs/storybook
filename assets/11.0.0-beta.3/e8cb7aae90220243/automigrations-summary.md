# Automigrations summary

These files could not be migrated automatically.
Update them by hand.
A section disappears once its migration runs again without failures.
Delete this file when you are done.

## argtypes-default-value

| File | Reason |
| ---- | ------ |
| `packages/eui/src/components/comment_list/comment.stories.tsx` | line 60: Cannot mutate argTypes.eventColor.defaultValue because the target contains unsupported member; line 61: Cannot mutate argTypes.actions.defaultValue because the target contains unsupported member |

## story-sort-to-main

| File | Reason |
| ---- | ------ |
| `packages/eui/.storybook/main.ts` | Cannot automigrate storySort: Cannot mutate a shared or reassigned config binding. Storybook no longer reads parameters.options.storySort from the preview. Move it to storySorts in the main config manually and remove the preview property. |
