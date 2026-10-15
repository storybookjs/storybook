---
name: upgrade
description: Use this skill when Storybook exists but needs an upgrade.
---

Storybook must end up at 11.0 or later. An 11.0 prerelease (`11.0.0-alpha.x`) or a canary build (`0.0.0-pr-*`) also counts.

Read https://storybook.js.org/docs/releases/upgrading.md in its **entirety** to get the latest Storybook upgrade instructions. Fetch the raw file (for example with `curl -sL`): a web fetch tool that returns a summary leaves steps out.

If the latest stable release is below 11.0, upgrade to the 11.0 alpha with `npx storybook@next upgrade` instead, and read https://storybook.js.org/docs/11/releases/upgrading.md, the instructions for that version. The upgrade goes one major version at a time: from Storybook 9 or older, run `npx storybook@10 upgrade` first, then the upgrade to 11.0. Stop only when the installed `storybook` is 11.0 or later.

Keep the files the upgrade adds, such as the Storybook agent skills and `skills-lock.json`: they are part of the upgrade.
