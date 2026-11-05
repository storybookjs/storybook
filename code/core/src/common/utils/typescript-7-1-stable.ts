// TEMPORARY(ts-7.1): TypeScript 7.1 is in beta until its stable release (planned for 2026-11-24),
// and `typescript@^7.1` matches no published version before then. Until it is stable, Storybook
// keeps installing and recommending TypeScript 6, and keeps the `react-docgen` fallback for React
// projects on TypeScript 7.0. Docgen on an installed TypeScript 7.1 works either way. Set
// `STORYBOOK_TYPESCRIPT_7_1_STABLE=true` to try the TypeScript 7.1 behaviour. Once 7.1 is stable,
// return `true` here, then delete this function and every `TEMPORARY(ts-7.1)` occurrence, and
// update the tests: `grep -rnE 'TEMPORARY\(ts-7.1\)|isTypeScript71Stable|STORYBOOK_TYPESCRIPT_7_1_STABLE'`.
export const isTypeScript71Stable = () => process.env.STORYBOOK_TYPESCRIPT_7_1_STABLE === 'true';
