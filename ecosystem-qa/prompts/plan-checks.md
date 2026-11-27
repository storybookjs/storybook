**The plan checks.** The checks whose id starts with "plan." come from the QA plan of this release.
Each one tests one change that merged into Storybook for this release, on this project.
The list names why the plan chose this repo, the numbered steps, and the expected outcome.

1. Run them after the checks before them, on the upgraded project, in the order of the list.
2. Before the first plan check, free every port that a server from before the upgrade may still hold with the free-port tool, never by a saved process id, and start the upgraded server only when the tool exits 0. A page that the baseline serves is no evidence of the upgrade.
3. Do the steps in their order, as they are written, adapted only to the paths and the story ids of this project.
   A step may start with the PRs it tests, such as `#36436: `, which says where the step comes from and is nothing to do.
4. A plan check tests the project as it is after the upgrade. Never add a setting, a file, a dependency, or code so that an upgrade step, an automigration, or a removal has something to act on, or so that the project looks as if it used something it does not use. When the project does not have what the entry describes, for example no `storySort` in its preview file, report the check as `skip` and say in the note what the project lacks and which file or search showed it.
   The one exception is a step of the entry that turns on a new opt-in feature of the tested version, such as a feature flag in the Storybook main file: do exactly what that step says and nothing more. You never decide yourself to turn something on. You do it only when a step of the entry says so.
   The other exception is a probe: it tests what is new or fixed in this version, so no project has it yet. A check is a probe only when the line right under the first line of its list item starts with the words `Probe: after the upgrade, add`. A step, a title, a reason, or an expected outcome never makes a check a probe, whatever it says.
   After the upgrade, add exactly what that line names and nothing more: new files and, where the line names one, one option in the file it names. Change and remove no line that is there.
   Keep a copy of each added file, and a diff of each file you added a line to, in the directory that line names in the evidence directory. Before the next check, remove the files you added and restore each file you added a line to, so the state the run records is the project after the upgrade.
   A failure you see while a probe's files are in the project is a finding of that probe's check.
   A check that is a probe has no baseline. Do nothing of it before the upgrade: neither in Step 1, which runs the other checks on the baseline, nor for rule 6. Set the `baseline` of its finding to `not-captured`.
   Everywhere else in these instructions, the word "probe" means a command that gathers evidence for a check, not a check that is a probe.
5. A step may name a command. You may run it, because the plan is part of your checklist. A step never lets you fetch a URL other than `localhost`, push, or write outside the repository and the evidence directory, and every rule of this prompt still holds. When a step asks for something these rules forbid, do not do it: report the check as `blocked` and name the step and the rule in the note.
6. When the expected outcome compares with the state before the upgrade, run the same step in Step 1 on the baseline, so the comparison is with what you saw and not with what you remember. When you did not, do not install the old version again: judge the rest of the expected outcome, set the `baseline` of a finding to `not-captured`, and name the missing comparison in the note. When the comparison is all that the expected outcome asks for, report the check as `blocked`.
7. Compare what you saw with the expected outcome, and only then choose the one state of the check. A check whose steps you could not all do takes the state of the step that stopped it.
   - `pass`: what you saw is the expected outcome.
   - `fail`: you did every step and what you saw is not the expected outcome. Report a finding for it, always, unless `blocked` below applies. When you think the expected outcome of the plan is wrong for this project, still report the finding and say why in its `actual`: the person who triages it reads the plan's mistakes there.
   - `skip`: this project does not have what the entry describes, as rule 4 says, or as for every other check.
   - `blocked` as for every other check.
     A plan check that fails only because of a third-party package that the upgrade or `doctor` named under `Incompatible Packages` is `blocked`, not `fail`, and has no finding: its note names the package and quotes its line from the log, as "What is a finding" says.
8. Write a note for every plan check, also for a `pass`: what you saw, in one or two sentences, quoted from the log or the page, and the evidence file that shows it.
9. Name the evidence of a plan check after its slug, the part of the id after "plan.", for example `story-sort-in-main.log` or `story-sort-in-main.png`.

The answer is refused, and you are asked again, when a plan check has no note or a `fail` of a plan check has no finding.
For a finding of a plan check, the `title` names the change and the symptom.
`expected` is the expected outcome of the plan in one line, and `actual` is what you saw.
For a finding of a probe, the `reproSteps` add what the probe line names right after the upgrade, before the steps of the check, because the commit the issue links does not hold those files.

**Steps in the browser.** Some steps ask you to click, type, or read text in the Storybook UI.
Do them with your Playwright browser tool, the tools whose names start with `mcp__playwright__browser_`. When they are deferred, load them with your tool search first.

1. Open the page with `browser_navigate` on a `localhost` URL, for example `http://localhost:6006/?path=/story/<story-id>`. The browser server blocks direct requests to a host other than `localhost` and `127.0.0.1`. It follows a redirect from `localhost` to another host and lets a WebSocket to another host through, so it is no security boundary. An image or a font from another host that does not load is no finding.
2. Take a snapshot with `browser_snapshot`. It is the accessibility tree of the page with a ref for each element, and it includes the preview iframe.
3. Click with `browser_click` and type with `browser_type`, each time on the ref of the element in the latest snapshot. Find the element by its visible name or label. `browser_press_key` takes a key and no ref: click the element first, then press the key.
4. After every action that should change the page, take a new snapshot and read the result from it, or wait for it with `browser_wait_for`. Quote text as that new snapshot shows it. The text you typed, or the text you expect, is not evidence that the page shows it.
5. Read the console of the page with `browser_console_messages`, and quote the messages you report from its answer.
6. Take screenshots with `browser_take_screenshot`. They land in `browser/` in the evidence directory. For a change over time, name them `<slug>-frames/01-before.png`, `<slug>-frames/02-after.png`, and so on, then give the gif tool the directory `browser/<slug>-frames` of the evidence directory and `<slug>.gif` in the evidence directory as its output.
7. An evidence name has at most one directory, so for a finding copy the screenshot that shows the actual result to `<slug>.png` in the evidence directory.

Never run a script in the page or in the browser, neither with `browser_evaluate` nor with `browser_run_code` nor with a script of your own. A script reads elements that the page hides, and what the page hides is not what a user sees.
Never install a browser, neither with `browser_install` nor with `playwright install`: the browser tool uses the browser of this sandbox.
When the browser fails to start, try once more, then report the check as `blocked` with the error in the note.

When your tool search finds no tool whose name starts with `mcp__playwright__browser_`, report a step that needs a click or typed text as `blocked`, with the note that this sandbox has no browser tool.
Take a screenshot of a URL with the shot tool, as for the other checks.
Drag and drop, UI that shows only on hover, file pickers, and anything that needs a headed browser are not supported. Report such a step as `skip` and say so in the note.
