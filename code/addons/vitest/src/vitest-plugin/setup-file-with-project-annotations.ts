import { setProjectAnnotations } from 'storybook/internal/preview-api';
import { ProjectAnnotationsAlreadyAppliedError } from 'storybook/internal/preview-errors';

// @ts-expect-error - virtual module provided by storybook-project-annotations-plugin
import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js';

// A user setup file that ran before this one has already called `setProjectAnnotations`
if (
  globalThis.__STORYBOOK_SET_PROJECT_ANNOTATIONS_CALLED__ &&
  !globalThis.__STORYBOOK_ADDON_VITEST_PROJECT_ANNOTATIONS_APPLIED__
) {
  throw new ProjectAnnotationsAlreadyAppliedError();
}

globalThis.__STORYBOOK_ADDON_VITEST_PROJECT_ANNOTATIONS_APPLIED__ = false;

// With `experimental_moduleImporters`, getProjectAnnotations returns a promise: the preview file
// is imported through the async importers first. Without them it returns the annotations directly.
setProjectAnnotations(await getProjectAnnotations());

// Later user calls would replace these annotations, so `setProjectAnnotations` refuses them from now on.
globalThis.__STORYBOOK_ADDON_VITEST_PROJECT_ANNOTATIONS_APPLIED__ = true;
