// @ts-expect-error - virtual module provided by storybook-project-annotations-plugin
import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js';

// Load project annotations from the virtual module provided by the Storybook Vite plugin
globalThis.globalProjectAnnotations = getProjectAnnotations();
