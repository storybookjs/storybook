import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['lib/index.ts', 'lib/configs/**/*.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  target: 'es6',
  outDir: 'dist',
  treeshake: true,
  sourcemap: false,
  minify: true,
})
