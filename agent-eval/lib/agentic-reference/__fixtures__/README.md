# Test fixtures

## `golden-run/`

A real captured run, trimmed and committed so the metric modules have a
permanent regression target that costs nothing to re-derive. `results/` is
gitignored, so without this the numbers below would be unreproducible.

Source: experiment `agentic-ref-reuse-component-cc-mcp-opus-high`, model
`opus`, eval `701-agentic-ref-reuse-component-mcp`, run 1, captured
2026-07-28. External repo pinned at
`yannbf/mealdrop@ce507b345666ea8678101fccac580186b2b69b1f`.

`transcript.json` keeps only `tool_call` events, with each event's verbose
`raw` field dropped (142KB to 24KB). `result.json` is verbatim.

Measured values, asserted by the tests:

| Metric              | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| duration            | 403.365s                                                |
| turns               | 12                                                      |
| tool calls          | 25                                                      |
| estimated cost      | $1.89273325                                             |
| cache hit rate      | 0.8330                                                  |
| buckets             | docs 1, exploration 14, edit 8, verification 7, other 0 |
| edits to Footer.tsx | 3                                                       |
| SLoC (stripped)     | +9 / -1 across 1 file                                   |
| SLoC (physical)     | +10 / -1 across 1 file                                  |

The agent's entire change was 10 added and 1 removed physical line in
`src/components/Footer/Footer.tsx`, confirmed by diffing the pinned ref
against the collected `project/` tree. One of those added lines is blank, so
the comment- and blank-stripped SLoC figure the metric reports is +9 / -1.
