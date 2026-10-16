/** @deprecated Use server-side docgen. See https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#builder-docgen-is-deprecated. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractComponentDescription(component?: any): string {
  return component?.__docgen?.description || '';
}
