import { StoryFnAngularReturnType } from '../types';
import { computesTemplateFromComponent } from './ComputesTemplateFromComponent';
import { createStorybookWrapperComponent } from './StorybookWrapperComponent';
import { PropertyExtractor } from './utils/PropertyExtractor';

export const getApplication = ({
  storyFnAngular,
  component,
  targetSelector,
  analyzedMetadata,
}: {
  storyFnAngular: StoryFnAngularReturnType;
  component?: any;
  targetSelector: string;
  analyzedMetadata: PropertyExtractor;
}) => {
  const { props, styles, moduleMetadata = {} } = storyFnAngular;
  let { template } = storyFnAngular;

  const hasTemplate = !hasNoTemplate(template);
  if (!hasTemplate && component) {
    template = computesTemplateFromComponent(component, props, '');
  }

  /**
   * Create a component that wraps generated template and gives it props
   */
  return createStorybookWrapperComponent({
    moduleMetadata,
    selector: targetSelector,
    template,
    storyComponent: component,
    styles,
    initialProps: props,
    analyzedMetadata,
  });
};

function hasNoTemplate(template: string | null | undefined): template is undefined {
  return template === null || template === undefined;
}
