import { setProjectAnnotations } from '@storybook/react'
import * as addonA11yAnnotations from '@storybook/addon-a11y/preview'
import * as projectAnnotations from './preview'
import { getString } from './setup-file-dependency';

setProjectAnnotations([
  addonA11yAnnotations,
  projectAnnotations,
]);

console.log(getString())
