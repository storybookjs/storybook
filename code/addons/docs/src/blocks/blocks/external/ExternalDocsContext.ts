import type { CSFFile, DocsContextProps, ModuleExports, Renderer } from 'storybook/internal/types';

import { DocsContext } from 'storybook/preview-api';
import type { StoryStore } from 'storybook/preview-api';

export class ExternalDocsContext<TRenderer extends Renderer> extends DocsContext<TRenderer> {
  constructor(
    public channel: DocsContext<TRenderer>['channel'],
    protected store: StoryStore<TRenderer>,
    public renderStoryToElement: DocsContextProps<TRenderer>['renderStoryToElement'],
    private processMetaExports: (metaExports: ModuleExports) => CSFFile<TRenderer>
  ) {
    super(
      channel,
      store,
      renderStoryToElement as DocsContextProps<TRenderer>['renderStoryToElement'],
      []
    );
  }

  referenceMeta = (metaExports: ModuleExports, attach: boolean) => {
    const csfFile = this.processMetaExports(metaExports);
    this.referenceCSFFile(csfFile);
    super.referenceMeta(metaExports, attach);
  };
}
