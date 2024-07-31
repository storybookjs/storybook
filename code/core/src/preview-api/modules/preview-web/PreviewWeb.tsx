/* eslint-disable no-underscore-dangle */
import { global } from '@storybook/global';

import { PreviewWithSelection } from './PreviewWithSelection';
import { UrlStore } from './UrlStore';
import { WebView } from './WebView';
import type { MaybePromise } from './Preview';
import type { Renderer } from '@storybook/core/types';
import type { ModuleImportFn, ProjectAnnotations } from '@storybook/core/types';

export class PreviewWeb<TRenderer extends Renderer> extends PreviewWithSelection<TRenderer> {
  constructor(
    public importFn: ModuleImportFn,

    public getProjectAnnotations: () => MaybePromise<ProjectAnnotations<TRenderer>>
  ) {
    super(importFn, getProjectAnnotations, new UrlStore(), new WebView());

    global.__STORYBOOK_PREVIEW__ = this;
  }
}
