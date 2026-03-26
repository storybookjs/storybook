import { setProjectAnnotations } from 'storybook/internal/preview-api';

// @ts-expect-error - virtual module provided by storybook-project-annotations-plugin
import { getProjectAnnotationsForVitest } from 'virtual:/@storybook/builder-vite/project-annotations.js';

// getProjectAnnotationsForVitest returns raw annotations without getCoreAnnotations() pre-applied.
// For CSF4/definePreview previews, this avoids doubling core annotations when setProjectAnnotations
// adds them. It also ensures module-level named exports (e.g. loaders, parameters defined outside
// of definePreview) are not silently dropped.
// For traditional previews, it is equivalent to getProjectAnnotations.
setProjectAnnotations(getProjectAnnotationsForVitest());
