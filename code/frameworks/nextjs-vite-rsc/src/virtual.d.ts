// See `project()` in preset.ts
declare module 'virtual:@storybook/nextjs-vite-rsc/project' {
  export const previewFiles: string[];
  export const workingDir: { root: string[]; cwd: string[] };
}
