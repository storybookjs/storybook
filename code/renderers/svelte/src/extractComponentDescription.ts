// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractComponentDescription(component?: any): string {
  return component?.__docgen?.description || '';
}
