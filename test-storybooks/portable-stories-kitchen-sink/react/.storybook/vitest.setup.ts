import { beforeAll } from 'vitest'
import { setProjectAnnotations } from '@storybook/react'
import * as addonA11yAnnotations from '@storybook/addon-a11y/preview'
import * as projectAnnotations from './preview'

const annotations = setProjectAnnotations([
  addonA11yAnnotations,
  projectAnnotations,
])

beforeAll(annotations.beforeAll)