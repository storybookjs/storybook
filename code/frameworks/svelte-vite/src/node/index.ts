import { createDefineMain } from 'storybook/internal/common'

import type { StorybookConfig } from '../types'

export const defineMain = createDefineMain<StorybookConfig>()

export type { StorybookConfig }
