import { Preview, composeConfigs } from 'storybook/internal/preview-api';
import type {
  Renderer,
  ComponentTitle,
  Path,
  ProjectAnnotations,
  ModuleExports,
  StoryIndex,
} from 'storybook/internal/types';
import { Channel } from 'storybook/internal/channels';

import { ExternalDocsContext } from './ExternalDocsContext';

type MetaExports = ModuleExports;

class ConstantMap<TKey, TValue extends string> {
  entries = new Map<TKey, TValue>();

  constructor(private prefix: string) {}

  get(key: TKey) {
    if (!this.entries.has(key)) {
      this.entries.set(key, `${this.prefix}${this.entries.size}` as TValue);
    }
    return this.entries.get(key);
  }
}

export class ExternalPreview<TRenderer extends Renderer = Renderer> extends Preview<TRenderer> {
  private importPaths = new ConstantMap<MetaExports, Path>('./importPath/');

  private titles = new ConstantMap<MetaExports, ComponentTitle>('title-');

  private storyIndex: StoryIndex = { v: 5, entries: {} };

  private moduleExportsByImportPath: Record<Path, ModuleExports> = {};

  constructor(public projectAnnotations: ProjectAnnotations<TRenderer>) {
    const importFn = (path: Path) => {
      return Promise.resolve(this.moduleExportsByImportPath[path]);
    };
    const getProjectAnnotations = () =>
      composeConfigs<TRenderer>([
        { parameters: { docs: { story: { inline: true } } } },
        this.projectAnnotations,
      ]);
    super(importFn, getProjectAnnotations, new Channel({}));
  }

  async getStoryIndexFromServer() {
    return this.storyIndex;
  }

  processMetaExports = (metaExports: MetaExports) => {
    const importPath = this.importPaths.get(metaExports);
    this.moduleExportsByImportPath[importPath] = metaExports;

    const title = metaExports.default.title || this.titles.get(metaExports);

    const csfFile = this.storyStoreValue.processCSFFileWithCache<TRenderer>(
      metaExports,
      importPath,
      title
    );

    Object.values(csfFile.stories).forEach(({ id, name }) => {
      this.storyIndex.entries[id] = {
        id,
        importPath,
        title,
        name,
        type: 'story',
      };
    });

    this.onStoriesChanged({ storyIndex: this.storyIndex });

    return csfFile;
  };

  docsContext = () => {
    return new ExternalDocsContext(
      this.channel,
      this.storyStoreValue,
      this.renderStoryToElement.bind(this),
      this.processMetaExports.bind(this)
    );
  };
}
