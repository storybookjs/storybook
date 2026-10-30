export type DocsCanvasProps = {
  storyId?: string;
  viewMode?: string;
  baseUrl: string;
  entry?: {
    id?: string;
    type?: string;
    importPath?: string;
  };
};

export type DocsCanvasRenderer = {
  render: (props: DocsCanvasProps) => unknown;
};

// Story mode, and docs with nothing registered, keep the single preview iframe.
export function selectDocsCanvas<T extends DocsCanvasRenderer>(
  viewMode: string | undefined,
  registered: Record<string, T> | null | undefined
): T | undefined {
  if (viewMode !== 'docs' || !registered) {
    return undefined;
  }
  const renderers = Object.values(registered);
  if (renderers.length === 0) {
    return undefined;
  }
  return renderers[0];
}

// A docs canvas renders its own toolbar per story frame, so the page-level one would target nothing.
export function showsPreviewToolbar(
  showToolbar: boolean,
  viewMode: string | undefined,
  registered: Record<string, DocsCanvasRenderer> | null | undefined
): boolean {
  return showToolbar && !selectDocsCanvas(viewMode, registered);
}
