# Sensitivity analysis

Baseline from `features.toml`, scanned at `01c60e170`. Each scenario changes one weight or modelling choice and re-evaluates the model against the same scan. Ranks are 1 = worst cost/usefulness ratio.

## One-at-a-time

Spearman correlation of the geometric ranking with the baseline (1.0 = identical order), the largest single rank move, the features moving 5+ places (baseline rank → new rank) and the user-facing features that change 2×2 quadrant.

| Scenario | Spearman | Max move | Movers | Quadrant flips |
|---|--:|--:|---|---|
| test_loc ×0.5 | 0.997 | 9 | `open-service` 57→66, `sidebar-search` 75→69, `toolsets` 69→74, `sidebar-tree` 41→46, `mcp` 72→77, `docgen-harness` 4→9 | - |
| test_loc ×1.5 | 0.998 | 6 | `sidebar-tree` 41→35, `mcp` 72→67 | - |
| dependency_base ×0.5 | 0.997 | 8 | `mdx` 71→79, `manager-theming` 66→73, `sidebar-context-menu` 60→66, `builder-webpack5` 32→38, `toolsets` 69→64, `framework-ember` 15→20 | - |
| dependency_base ×1.5 | 0.998 | 6 | `open-service` 57→63, `toolsets` 69→74, `sidebar-search` 75→70 | - |
| dependency_per_release ×0.5 | 0.999 | 6 | `links` 68→74 | - |
| dependency_per_release ×1.5 | 0.999 | 4 | - | - |
| dependency_stale_penalty ×0.5 | 0.999 | 3 | - | - |
| dependency_stale_penalty ×1.5 | 0.999 | 4 | - | - |
| fix_pr ×0.5 | 0.997 | 6 | `vitest-addon` 34→40, `viewport` 67→73, `init` 56→62, `story-indexing` 76→81, `renderer-vue3` 43→48, `framework-sveltekit` 38→33 | - |
| fix_pr ×1.5 | 0.997 | 7 | `renderer-svelte` 58→65, `viewport` 67→61, `open-service` 57→63, `links` 68→74, `dev-server` 63→57, `sidebar-search` 75→70 | - |
| maintenance_pr ×0.5 | 0.999 | 3 | - | - |
| maintenance_pr ×1.5 | 0.999 | 4 | - | - |
| fix_pr = 0 (no churn pricing) | 0.982 | 20 | `init` 56→76, `dev-server` 63→79, `renderer-vue3` 43→56, `open-in-editor` 83→70, `e2e-internal` 35→48, `renderer-html` 81→69 | `module-graph-service`, `change-detection`, `renderer-vue3`, `builder-vite` |
| dependency_base = 0 (no dependency pricing) | 0.969 | 21 | `sidebar-context-menu` 60→81, `framework-ember` 15→36, `outline` 17→37, `update-notifications` 25→43, `open-in-editor` 83→100, `links` 68→83 | `module-graph-service`, `builder-manager` |
| test_loc = 0 (ignore tests) | 0.988 | 25 | `docgen-harness` 4→29, `open-service` 57→71, `sidebar-tree` 41→54, `renderer-svelte` 58→70, `sidebar-search` 75→65, `toolsets` 69→77 | `change-detection`, `preview-store` |
| internal_fan_out = 100 | 0.979 | 43 | `framework-preact-vite` 82→39, `renderer-html` 81→67, `manager-theming` 66→78, `links` 68→57, `framework-html-vite` 97→87, `themes` 65→56 | `change-detection`, `preview-store` |
| geometric_base = 2 | 0.898 | 30 | `outline` 17→47, `framework-ember` 15→45, `renderer-preact` 13→42, `highlight` 54→82, `sidebar-context-menu` 60→84, `embed-mode` 52→76 | - |
| geometric_base = 4 | 0.968 | 28 | `framework-preact-vite` 82→54, `renderer-html` 81→64, `open-in-editor` 83→66, `open-service` 57→72, `init` 56→70, `docgen-react` 53→67 | - |
| inheritance one-hop | 1.0 | 0 | inherited score changes: `svelte-csf` 3→2 | - |

## Summary

- Every cost weight at ×0.5 or ×1.5 keeps the ranking within Spearman 0.997 of the baseline.
- The largest reordering comes from `geometric_base = 2` (Spearman 0.898, largest move 30 places).
- User-facing features that change 2×2 quadrant in at least one scenario: `change-detection` (fix_pr = 0 (no churn pricing), test_loc = 0 (ignore tests), internal_fan_out = 100), `module-graph-service` (fix_pr = 0 (no churn pricing), dependency_base = 0 (no dependency pricing)), `preview-store` (test_loc = 0 (ignore tests), internal_fan_out = 100), `renderer-vue3` (fix_pr = 0 (no churn pricing)), `builder-vite` (fix_pr = 0 (no churn pricing)), `builder-manager` (dependency_base = 0 (no dependency pricing)).
- The 2×2 splits usefulness between 2 and 3, so a feature scoring 2 or 3 with above-median cost changes quadrant with a one-step change of its score; `score-review.md` lists those features.
