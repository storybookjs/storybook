import { fileURLToPath } from 'node:url';

const renderer = fileURLToPath(new URL('../native-renderer/preset.js', import.meta.url));

export const core = () => ({ renderer });
export const addons = [renderer];
export const previewAnnotations = (input = []) => [...input, '/framework-preview.ts'];
