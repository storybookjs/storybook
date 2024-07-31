import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestCommonConfig } from '../vitest.workspace';

export default mergeConfig(vitestCommonConfig, defineConfig({}));
