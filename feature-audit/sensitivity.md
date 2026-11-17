# Sensitivity analysis

Baseline from `features.toml`, scanned at `00059337f08`. Each scenario changes one weight or modelling choice and re-evaluates the model against the same scan. Ranks are 1 = worst cost/usefulness ratio.

## One-at-a-time

Spearman correlation of the geometric ranking with the baseline (1.0 = identical order), the largest single rank move, the features moving 5+ places (baseline rank → new rank) and the user-facing features that change 2×2 quadrant.

| Scenario | Spearman | Max move | Movers | Quadrant flips |
|---|--:|--:|---|---|
| test_loc ×0.5 | 0.998 | 7 | `renderer-svelte` 64→71, `open-service` 58→65, `sidebar-tree` 39→44 | - |
| test_loc ×1.5 | 0.998 | 7 | `mcp` 71→64 | - |
| dependency_base ×0.5 | 0.997 | 8 | `mdx` 70→78, `toolsets` 73→67, `viewport` 65→60, `manager-theming` 66→71 | - |
| dependency_base ×1.5 | 0.998 | 7 | `manager-theming` 66→59, `mdx` 70→65 | - |
| dependency_per_release ×0.5 | 0.999 | 6 | `links` 67→73 | - |
| dependency_per_release ×1.5 | 0.999 | 5 | `links` 67→62 | - |
| dependency_stale_penalty ×0.5 | 0.999 | 4 | - | - |
| dependency_stale_penalty ×1.5 | 0.999 | 4 | - | - |
| fix_pr ×0.5 | 0.996 | 9 | `init` 56→65, `dev-server` 61→68, `viewport` 65→71, `links` 67→61, `framework-tanstack-react` 19→25, `renderer-vue3` 42→47 | `module-graph-service`, `change-detection` |
| fix_pr ×1.5 | 0.997 | 8 | `renderer-svelte` 64→72, `cli-core` 74→68, `viewport` 65→60, `story-indexing` 75→70, `highlight` 52→57, `framework-react-webpack5` 26→21 | - |
| maintenance_pr ×0.5 | 0.999 | 3 | - | - |
| maintenance_pr ×1.5 | 0.999 | 3 | - | - |
| fix_pr = 0 (no churn pricing) | 0.978 | 24 | `init` 56→80, `dev-server` 61→78, `renderer-vue3` 42→58, `renderer-html` 80→66, `open-in-editor` 82→68, `highlight` 52→40 | `module-graph-service`, `logging`, `renderer-vue3`, `renderer-react` |
| dependency_base = 0 (no dependency pricing) | 0.969 | 22 | `sidebar-context-menu` 59→81, `outline` 16→34, `open-in-editor` 82→100, `docgen-svelte` 28→46, `framework-preact-vite` 81→64, `update-notifications` 23→39 | `module-graph-service`, `change-detection` |
| test_loc = 0 (ignore tests) | 0.988 | 25 | `docgen-harness` 6→31, `sidebar-tree` 39→54, `open-service` 58→70, `renderer-svelte` 64→75, `csf-tools` 55→64, `mcp` 71→79 | `onboarding`, `preview-store` |
| internal_fan_out = 100 | 0.978 | 42 | `framework-preact-vite` 81→39, `renderer-html` 80→66, `manager-theming` 66→79, `framework-html-vite` 96→84, `links` 67→56, `save-story` 47→37 | - |
| geometric_base = 2 | 0.899 | 31 | `outline` 16→47, `highlight` 52→81, `renderer-preact` 13→40, `framework-ember` 9→36, `sidebar-context-menu` 59→84, `embed-mode` 51→76 | - |
| geometric_base = 4 | 0.964 | 29 | `framework-preact-vite` 81→52, `renderer-html` 80→60, `open-in-editor` 82→64, `init` 56→71, `open-service` 58→72, `links` 67→53 | - |
| inheritance one-hop | 1.0 | 0 | inherited score changes: none | - |

## Summary

- Every cost weight at ×0.5 or ×1.5 keeps the ranking within Spearman 0.996 of the baseline.
- The largest reordering comes from `geometric_base = 2` (Spearman 0.899, largest move 31 places).
- User-facing features that change 2×2 quadrant in at least one scenario: `module-graph-service` (fix_pr ×0.5, fix_pr = 0 (no churn pricing), dependency_base = 0 (no dependency pricing)), `change-detection` (fix_pr ×0.5, dependency_base = 0 (no dependency pricing)), `logging` (fix_pr = 0 (no churn pricing)), `renderer-vue3` (fix_pr = 0 (no churn pricing)), `renderer-react` (fix_pr = 0 (no churn pricing)), `onboarding` (test_loc = 0 (ignore tests)), `preview-store` (test_loc = 0 (ignore tests)).
- The 2×2 splits usefulness between 2 and 3, so a feature scoring 2 or 3 with above-median cost changes quadrant with a one-step change of its score; `score-review.md` lists those features.
