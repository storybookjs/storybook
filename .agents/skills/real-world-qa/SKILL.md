---
name: real-world-qa
description: Tests a change the way a user meets it, in real projects or the real tool, and compares the result on the base and on this head. Use when the user asks for real-world QA, to try a change in real projects, or to check that it works outside the tests.
metadata:
  internal: true
---

# Real-world QA

Tests prove what their author thought of. Real-world QA runs the change where users meet it: in projects nobody wrote for this change, through the commands and the UI that users use. It often finds what the tests and the reviews missed.

Each change needs other targets, so this skill tells you how to find them, not a list of them.

## Steps

1. **Name the surface.** What does a user do, see, or get from a tool when this change is in? For example: the stories a framework indexes, the Controls of a component, the events that telemetry sends, the files an automigration writes, the output of a CLI command. Done when you can say what to observe and what the expected result is.

2. **Find the targets.** Pick two or three that show the surface in different setups. Look in this order:
   - **Real projects.** Open-source projects that use the affected framework, package or API with Storybook. Search GitHub (`gh search code`, `gh search repos`) for their `.storybook/main.*` or for the API the change touches. Prefer active projects, and pick different setups (for example SvelteKit and plain Svelte with Vite). Clone them outside this checkout.
   - **Sandboxes.** `yarn task sandbox --template <key>`; see [Sandboxes](../../guidelines/sandboxes.md). Use them when no real project uses the surface yet, or to check one template against another.
   - **The repo's own tools.** Some surfaces have a local tool in `scripts/`, for example `scripts/event-log-collector.ts`, which receives telemetry events. Look there before you build your own.

   To put this head into a real project, install a canary (the [`canary` skill](../canary/SKILL.md)), or publish to the local registry (`cd code && yarn local-registry --help`).

3. **Run the base and this head.** Do the same steps on each, and keep what shows the difference: commands, logs, counts, timings, screenshots. A difference you did not expect is a finding. A finding that a real project shows is in scope by definition.

4. **Report.** For each target: what you ran, what you saw on the base and on this head, and the findings. Fix the findings, or give them to the user. Keep the evidence that a reviewer can rerun: it goes into the PR's "Manual testing" section.

Done when each target has a base result and a head result, and each finding is fixed or reported.

Stay read-only towards the real projects: do not push to them, and do not open issues or PRs there.
