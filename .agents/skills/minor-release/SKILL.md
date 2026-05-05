---
name: minor-release
description: Write the changelog entry for a new minor or major Storybook release. Use when preparing a CHANGELOG.md entry for a X.Y.0 version.
allowed-tools: Bash, Read, Write, Edit
---

# Write Minor/Major Release Changelog

Assembles and writes a polished changelog entry for a Storybook minor or major (`X.Y.0`) release into `CHANGELOG.md`.

## Rules — read before doing anything

- **The two helper scripts are at `.agents/skills/minor-release/get-minor-changelog-summary.ts` and `.agents/skills/minor-release/write-minor-changelog-section.ts`. Do not search for them anywhere else in the repo. Do not look in `scripts/`, `package.json`, `AGENTS.md`, or elsewhere. Do not read the script source files. Just run them.**
- **Do not read `CHANGELOG.md` or `CHANGELOG.prerelease.md` before running the scripts.** The scripts handle version detection and entry collection automatically.
- **Do not read `CHANGELOG.md` for style guidance.** The style examples in Step 3 of this skill are the authoritative reference. Do not grep or read the changelog to infer format.
- Run all commands from the repository root.

## Step 1: Collect the changelog entries

Run the helper script to see all unique changelog entries from the prereleases, with patch-backported changes filtered out:

```bash
node --experimental-strip-types .agents/skills/minor-release/get-minor-changelog-summary.ts [version]
```

- Omit `[version]` to auto-detect from the most recent prerelease in `CHANGELOG.prerelease.md`
- Pass `--verbose` to see which prerelease versions were found and how many patch PRs were filtered
- The output is a plain list of `- Entry text` lines, one per change

Read the output carefully — you will use these entries in Step 2 to choose highlights.

## Step 2: Select highlights

From the entries collected in Step 1, identify the **4–8 most significant changes** to feature as highlights. If fewer than 4 significant changes exist, include all available significant changes rather than padding the list with minor items. Good candidates:

- Major new features or capabilities
- New framework/ecosystem support (new renderer, builder, or major version support)
- Prominent DX or performance improvements
- Significant experimental features worth calling out

Exclude from highlights (they still belong in the full list):

- Bug fixes
- Maintenance, cleanup, dependency updates
- Minor improvements or internal refactors
- Reverts

## Step 3: Compose the highlights text

Based on the entries from Step 2, write the highlights section — the text that goes between the `## X.Y.0` heading and the full entry list. This is what you will pass to the write script. Follow the `Writing style` rules below.

### Writing style

The highlights text should contain only these parts, in order:

- An optional tagline line in the form `> _..._`
- One intro sentence
- One or more highlight bullet lists

Do not include the `## X.Y.0` heading — the script adds that.

The default format is:

```text
> _Tagline phrase_

Storybook X.Y [intro sentence]:

- 🔣 Highlight one: brief description
- 🔣 Highlight two: brief description
- 🔣 Highlight three: brief description
```

For releases with 7-8 highlights, a second group of bullets with its own intro sentence is fine (see 10.1.0 example).

**Style rules:**
- The tagline is wrapped in `> _italics_`. It is a short (5–10 word) noun phrase summarising the release theme — no verbs, no "we".
- Each highlight bullet: relevant emoji, feature/area name, brief description. Terse and specific.
- The intro sentence uses `Storybook X.Y contains hundreds of fixes and improvements including:` for most releases. For a major version, the intro is more impactful (see 10.0.0 example).

### Examples

**10.3.0** — a typical release with a single highlight group:

```text
> _Improved developer experience, AI-assisting tools, and broader ecosystem support_

Storybook 10.3 contains hundreds of fixes and improvements including:

- 🤖 Storybook MCP: Agentic component dev, docs, and test (Preview release for React)
- ⚡ Vite 8 support
- ▲ Next.js 16.2 support
- 📝 ESLint 10 support
- 〰️ Addon Pseudo-States: Tailwind v4 support
- 🔧 Addon-Vitest: Simplified configuration - no more setup files required
- ♿ Numerous accessibility improvements across the UI
```

**10.1.0** — a release with multiple highlight groups:

```text
> _Easier to setup, more accessible to use_

Storybook 10.1 focuses on two key improvements: installation and accessibility:

- ♿ UI overhaul to fix hundreds of a11y issues
- 🧑‍💻 CLI overhaul for faster, more reliable install
- ✅ Checklist-based onboarding guide for new users

The release also contains compatibility fixes for:

- 🅰️ Angular 21 support
- 🦀 RSbuild install support in CLI
- ⚡️ Preact support for Vitest addon

Finally, it contains two highly-requested experimental features:

- 📋 Component manifest for Storybook MCP
- ⚛️ Improved JSX code snippets for React
```

**10.0.0** — a major release with a more impactful intro (no `>` tagline, two-sentence intro):

```text
Storybook 10 contains one breaking change: it's ESM-only. This simplifies our distribution and reduces install size by 29% while simultaneously unminifying dist code for easier debugging.
It also includes features to level up your UI development, documentation, and testing workflows:

- 🧩 Module automocking for easier testing
- 🏭 Typesafe CSF factories Preview for React
- 💫 UI editing and sharing optimizations
- 🏷️ Tag filtering exclusion and configuration for sidebar management
- 🔀 Next 16, Vitest 4, Svelte async components, and more!
```

## Step 4: Write the changelog entry

Pass the highlights text to the write script via stdin. The script will call the summary script internally, combine the full entry list with your highlights, and write the complete section to `CHANGELOG.md` — inserting at the top or overwriting any existing section for this version.

```bash
node --experimental-strip-types .agents/skills/minor-release/write-minor-changelog-section.ts [version] << 'HIGHLIGHTS'
> _Your tagline here_

Storybook X.Y contains hundreds of fixes and improvements including:

- 🔣 Highlight one
- 🔣 Highlight two
HIGHLIGHTS
```

Use `--dry-run` to preview the composed section before writing:

```bash
node --experimental-strip-types .agents/skills/minor-release/write-minor-changelog-section.ts --dry-run << 'HIGHLIGHTS'
...
HIGHLIGHTS
```
