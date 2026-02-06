import { version } from 'vite';

// TODO: Remove once support for Vite < 8 is dropped
const getUseRolldownOptions = () => {
  try {
    return Number(version.split('.')[0]) >= 8;
  } catch {
    return false;
  }
};

/**
 * Returns the correct bundler options key based on the installed Vite version. Vite 8 renamed
 * `build.rollupOptions` to `build.rolldownOptions`.
 */
// TODO: Remove once support for Vite < 8 is dropped, and use 'rolldownOptions' directly
export const bundlerOptionsKey = getUseRolldownOptions() ? 'rolldownOptions' : 'rollupOptions';
