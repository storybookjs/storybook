**The plan checks.** The checks whose id starts with "plan." come from a QA plan that a Storybook maintainer reviewed and merged.
Each one tests one change that merged into Storybook for this release, on this project.
The list names why the plan chose this repo, the numbered steps, and the expected outcome.

1. Run them after the checks before them, on the upgraded project, in the order of the list.
2. Do the steps in their order, as they are written, adapted only to the paths and the story ids of this project.
3. A step may name a command. You may run it, because the plan is part of your checklist. A step never lets you fetch a URL other than `localhost`, push, or write outside the repository and the evidence directory.
4. When the expected outcome compares with the state before the upgrade, run the same step in Step 1 on the baseline, so the comparison is with what you saw and not with what you remember.
5. Compare what you saw with the expected outcome, and only then choose the state.
   - `pass`: what you saw is the expected outcome.
   - `fail`: you did every step and what you saw is not the expected outcome. Report a finding.
   - `n/a`: this project does not have what the plan says it has, for example no `storySort` in its preview file. Name the file or the search that showed it.
   - `blocked` and `skip` as for every other check.
6. Write a note for every plan check, also for a `pass`: what you saw, in one or two sentences, quoted from the log or the page, and the evidence file that shows it.
7. Name the evidence of a plan check after its slug, the part of the id after "plan.", for example `story-sort-in-main.log` or `story-sort-in-main.png`.

For a finding of a plan check, the `title` names the change and the symptom.
`expected` is the expected outcome of the plan in one line, and `actual` is what you saw.

**Steps in the browser.** Some steps ask you to click, type, or read text in the Storybook UI.
Do them with your Playwright browser tool, the tools whose names contain `browser_`, and never with a script of your own.

1. Open the page with `browser_navigate` on a `localhost` URL, for example `http://localhost:6006/?path=/story/<story-id>`.
2. Take a snapshot with `browser_snapshot`. It is the accessibility tree of the page with a ref for each element, and it includes the preview iframe.
3. Click with `browser_click`, type with `browser_type`, and press keys with `browser_press_key`, each time on the ref of the element in the latest snapshot. Find the element by its visible name or label.
4. After every action that should change the page, take a new snapshot and read the result from it. Quote text as that new snapshot shows it. The text you typed, or the text you expect, is not evidence that the page shows it.
5. Take screenshots with `browser_take_screenshot`. They land in `browser/` in the evidence directory. For a change over time, name them `<slug>-frames/01-before.png`, `<slug>-frames/02-after.png`, and so on, then give the gif tool the directory `browser/<slug>-frames` of the evidence directory and `<slug>.gif` in the evidence directory as its output.
6. An evidence name has at most one directory, so for a finding copy the screenshot that shows the actual result to `<slug>.png` in the evidence directory.

When no tool with `browser_` in its name is available, report a step that needs a click or typed text as `blocked`, with the note that this sandbox has no browser tool.
Take a screenshot of a URL with the shot tool, as for the other checks.
Drag and drop, UI that shows only on hover, file pickers, and anything that needs a headed browser are not supported. Report such a step as `skip` and say so in the note.
