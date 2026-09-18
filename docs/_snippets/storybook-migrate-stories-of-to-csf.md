```sh renderer="common" packageManager="npm"
# Convert storiesOf to CSF 1
npx storybook@latest migrate storiesof-to-csf --glob="**/*.stories.tsx" --parser=tsx
```

```sh renderer="common" packageManager="pnpm"
# Convert storiesOf to CSF 1
pnpm dlx storybook@latest migrate storiesof-to-csf --glob="**/*.stories.tsx" --parser=tsx
```

```sh renderer="common" packageManager="yarn"
# Convert storiesOf to CSF 1
yarn dlx storybook@latest migrate storiesof-to-csf --glob="**/*.stories.tsx" --parser=tsx
```
