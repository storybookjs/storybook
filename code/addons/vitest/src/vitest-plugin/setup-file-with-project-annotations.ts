import { setProjectAnnotations } from 'storybook/internal/preview-api';

// @ts-expect-error - virtual module provided by storybook-project-annotations-plugin
import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js';

setProjectAnnotations(getProjectAnnotations());
