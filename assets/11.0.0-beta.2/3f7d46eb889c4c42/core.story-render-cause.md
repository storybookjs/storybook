Cause: after the upgrade the RTL decorator reads context.globals.direction, which is undefined, so the story crashes.
Error (verbatim from the first story render): TypeError: item[context.globals.direction] is not iterable (cannot read property undefined)
  at WithRTL (http://localhost:6006/decorators/with-rtl.jsx:25:9)
Where: storybook/preview.jsx globalTypes.direction / css / maxWidthWrapper carry defaultValue. In Storybook 11 globals are seeded from initialGlobals only (MIGRATION.md, "Toolbar globalTypes entries: index signature and defaultValue removed").
Fix applied: moved the three defaults to an export const initialGlobals in storybook/preview.jsx (commit 7e6a66a). The story then renders.
