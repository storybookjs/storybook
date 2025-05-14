import type { Loader, StoryContext } from '@storybook/react-vite';
import { useRef, useState, useCallback } from 'react';

export const loader: Loader =
  async ({ args }): Promise<{ metafile_content: string; } | undefined> => {
    if (!args.metafile) {
      return;
    }
    try {
      const metafile_content = await (await fetch(args.metafile as string)).text();
      return { metafile_content };
    } catch (e) {
      return;
    }
  };

export const render = (args: any, { loaded, viewMode }: StoryContext) => {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  const handleLoad = useCallback(() => {
    ref.current?.contentWindow?.postMessage(
      { type: 'esbuild-metafile', metafile: loaded.metafile_content },
      '*'
    );

    // observe the size inside the iframe
    const contentElement = ref.current?.contentWindow?.document.getElementById('resultsPanel');
    const observer = new ResizeObserver(() => {

      if (!contentElement) {
        return;
      }
      const measured = contentElement.getBoundingClientRect().height;
      setHeight(Math.min(measured || 200, 800) + 100);
    });
    if (contentElement) {
      observer.observe(contentElement);
    }

    return () => observer.disconnect();
  }, []);

  const style: any = viewMode === 'docs' ?
    { width: '100%', height, border: 'none', display: 'block' } : { width: '100vw', height: '100vh', border: 'none', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 };

  return (
    <iframe
      title="bundle-analyzer"
      style={style}
      ref={ref}
      src="./bundle-analyzer/index.html"
      onLoad={handleLoad} />
  );
};
