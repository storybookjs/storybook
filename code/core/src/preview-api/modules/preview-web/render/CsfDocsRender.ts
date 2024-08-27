import type { Channel } from '@storybook/core/channels';
import type { Renderer, StoryId } from '@storybook/core/types';
import type { CSFFile, PreparedStory } from '@storybook/core/types';
import type { IndexEntry } from '@storybook/core/types';
import type { RenderContextCallbacks } from '@storybook/core/types';

import { DOCS_RENDERED } from '@storybook/core/core-events';

import type { StoryStore } from '../../../store';
import { DocsContext } from '../docs-context/DocsContext';
import type { DocsContextProps } from '../docs-context/DocsContextProps';
import type { DocsRenderFunction } from '../docs-context/DocsRenderFunction';
import type { Render, RenderType } from './Render';
import { PREPARE_ABORTED } from './Render';

/**
 * A CsfDocsRender is a render of a docs entry that is rendered based on a CSF file.
 *
 * The expectation is the primary CSF file which is the `importPath` for the entry will define a
 * story which may contain the actual rendered JSX code for the template in the `docs.page`
 * parameter.
 *
 * Use cases:
 *
 * - Autodocs, where there is no story, and we fall back to the globally defined template.
 */
export class CsfDocsRender<TRenderer extends Renderer> implements Render<TRenderer> {
  public readonly type: RenderType = 'docs';

  public readonly subtype = 'csf';

  public readonly id: StoryId;

  public story?: PreparedStory<TRenderer>;

  public rerender?: () => Promise<void>;

  public teardownRender?: (options: { viewModeChanged?: boolean }) => Promise<void>;

  public torndown = false;

  public readonly disableKeyListeners = false;

  public preparing = false;

  public csfFiles?: CSFFile<TRenderer>[];

  constructor(
    protected channel: Channel,
    protected store: StoryStore<TRenderer>,
    public entry: IndexEntry,
    private callbacks: RenderContextCallbacks<TRenderer>
  ) {
    this.id = entry.id;
  }

  isPreparing() {
    return this.preparing;
  }

  async prepare() {
    this.preparing = true;
    const { entryExports, csfFiles = [] } = await this.store.loadEntry(this.id);

    if (this.torndown) {
      throw PREPARE_ABORTED;
    }

    const { importPath, title } = this.entry;
    const primaryCsfFile = this.store.processCSFFileWithCache<TRenderer>(
      entryExports,
      importPath,
      title
    );

    // We use the first ("primary") story from the CSF as the "current" story on the context.
    //   - When rendering "true" CSF files, this is for back-compat, where templates may expect
    //     a story to be current (even though now we render a separate docs entry from the stories)
    //   - when rendering a "docs only" (story) id, this will end up being the same story as
    //     this.id, as such "CSF files" have only one story
    const primaryStoryId = Object.keys(primaryCsfFile.stories)[0];
    this.story = this.store.storyFromCSFFile({ storyId: primaryStoryId, csfFile: primaryCsfFile });

    this.csfFiles = [primaryCsfFile, ...csfFiles];

    this.preparing = false;
  }

  isEqual(other: Render<TRenderer>): boolean {
    return !!(
      this.id === other.id &&
      this.story &&
      this.story === (other as CsfDocsRender<TRenderer>).story
    );
  }

  docsContext(renderStoryToElement: DocsContextProps<TRenderer>['renderStoryToElement']) {
    if (!this.csfFiles) {
      throw new Error('Cannot render docs before preparing');
    }
    const docsContext = new DocsContext<TRenderer>(
      this.channel,
      this.store,
      renderStoryToElement,
      this.csfFiles
    );
    // All referenced CSF files should be attached for CSF docs
    //  - When you create two CSF files that both reference the same title, they are combined into
    //    a single CSF docs entry with a `storiesImport` defined.
    this.csfFiles.forEach((csfFile) => docsContext.attachCSFFile(csfFile));
    return docsContext;
  }

  async renderToElement(
    canvasElement: TRenderer['canvasElement'],
    renderStoryToElement: DocsContextProps<TRenderer>['renderStoryToElement']
  ) {
    if (!this.story || !this.csfFiles) {
      throw new Error('Cannot render docs before preparing');
    }

    const docsContext = this.docsContext(renderStoryToElement);

    const { docs: docsParameter } = this.story.parameters || {};

    if (!docsParameter) {
      throw new Error(
        `Cannot render a story in viewMode=docs if \`@storybook/addon-docs\` is not installed`
      );
    }

    const renderer = await docsParameter.renderer();
    const { render } = renderer as { render: DocsRenderFunction<TRenderer> };
    const renderDocs = async () => {
      try {
        // NOTE: it isn't currently possible to use a docs renderer outside of "web" mode.
        await render(docsContext, docsParameter, canvasElement as any);
        this.channel.emit(DOCS_RENDERED, this.id);
      } catch (err) {
        this.callbacks.showException(err as Error);
      }
    };

    this.rerender = async () => renderDocs();
    this.teardownRender = async ({ viewModeChanged }: { viewModeChanged?: boolean }) => {
      if (!viewModeChanged || !canvasElement) {
        return;
      }
      renderer.unmount(canvasElement);
    };

    return renderDocs();
  }

  async teardown({ viewModeChanged }: { viewModeChanged?: boolean } = {}) {
    this.teardownRender?.({ viewModeChanged });
    this.torndown = true;
  }
}
