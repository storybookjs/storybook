import type { ModuleImportFn, ProjectAnnotations } from 'storybook/internal/types';
import type { Renderer } from 'storybook/internal/types';

import { global } from '@storybook/global';

import type { MaybePromise } from './Preview.tsx';
import { PreviewWithSelection } from './PreviewWithSelection.tsx';
import { UrlStore } from './UrlStore.ts';
import { WebView } from './WebView.ts';

export class PreviewWeb<TRenderer extends Renderer> extends PreviewWithSelection<TRenderer> {
  constructor(
    public importFn: ModuleImportFn,

    public getProjectAnnotations: () => MaybePromise<ProjectAnnotations<TRenderer>>
  ) {
    super(importFn, getProjectAnnotations, new UrlStore(), new WebView());

    global.__STORYBOOK_PREVIEW__ = this;
  }
}
