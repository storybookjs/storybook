```sh renderer="common" packageManager="npm"
# Convert CSF 2 to CSF 3
npx storybook@latest migrate csf-2-to-3 --glob="**/*.stories.tsx" --parser=tsx
```

```sh renderer="common" packageManager="pnpm"
# Convert CSF 2 to CSF 3
pnpm dlx storybook@latest migrate csf-2-to-3 --glob="**/*.stories.tsx" --parser=tsx
```

```sh renderer="common" packageManager="yarn"
# Convert CSF 2 to CSF 3
yarn dlx storybook@latest migrate csf-2-to-3 --glob="**/*.stories.tsx" --parser=tsx
```
