import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../code/vitest.shared.ts';

export default mergeConfig(vitestCommonConfig, defineConfig({}));
