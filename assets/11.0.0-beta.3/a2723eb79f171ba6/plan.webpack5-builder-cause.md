# plan.webpack5-builder: first story fails to render (TypeError reading 'split')

File and line: storybook/preview.js:107, `context.kind.split('/')[2]` inside the decorators.

Why it fails: in 11.0.0-beta.3 the decorator context no longer carries `kind` (guide, 10.x to 11.0.0 section, around the "context.kind"/"title and name" paragraph: custom helpers must read `context.title` and `context.name`). `context.kind` is undefined, so `.split` throws. Baseline 10.6.4 rendered all--all with 0 page errors (baseline-story.png.errors.json is []).

Fix tried: read `context.title` in place of `context.kind` at the same line. Nothing else changed.
