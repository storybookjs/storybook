```sh renderer="common" language="js" packageManager="npm"
# Convert storiesOf to CSF 1
npx storybook@latest migrate storiesof-to-csf --glob="**/*.stories.tsx" --parser=tsx
```

```sh renderer="common" language="js" packageManager="pnpm"
# Convert storiesOf to CSF 1
pnpm dlx storybook@latest migrate storiesof-to-csf --glob="**/*.stories.tsx" --parser=tsx
```

```sh renderer="common" language="js" packageManager="yarn"
# Convert storiesOf to CSF 1
yarn dlx storybook@latest migrate storiesof-to-csf --glob="**/*.stories.tsx" --parser=tsx
```
