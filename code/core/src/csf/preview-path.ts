/**
 * Lives in its own module so the ESLint plugin can bundle it without the rest of the CSF
 * utilities; re-exported through csf-utils.ts and csf-tools.
 */
const PREVIEW_FILE_REGEX = /\/preview(.(js|jsx|mjs|ts|tsx))?$/;

/** Whether an import path points at a `.storybook/preview` file, making it a CSF factory source. */
export const isValidPreviewPath = (filepath: string) => PREVIEW_FILE_REGEX.test(filepath);
