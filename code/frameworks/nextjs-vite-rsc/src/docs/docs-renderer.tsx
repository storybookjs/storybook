// Code of the browser layer, which the preview has a stand-in for: see addon-docs.ts

export async function createDocsRenderer() {
  const { DocsRenderer } = await import('@storybook/addon-docs');
  return new DocsRenderer();
}
