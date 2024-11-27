/// <reference types="webpack-env" />
import './globals';

export * from './public-types';
export * from './portable-stories';

export type { StoryFnAngularReturnType as IStory } from './types';

export { argsToTemplate } from './argsToTemplate';
export { moduleMetadata, componentWrapperDecorator, applicationConfig } from './decorators';

// optimization: stop HMR propagation in webpack
if (typeof module !== 'undefined') module?.hot?.decline();
