# Annotating why a coding agent loaded a Storybook story

You are annotating tool calls from transcripts of a coding agent (Claude Code) working on a React app
("MealDrop") that uses a design system ("Droppy"). The agent could query a Storybook MCP server:

- `GET DOCS <component>` returns a component's docs. Some of its stories are shown in full (source code);
  the others are only listed, by name and sometimes a one-line description.
- `LOAD STORY <component> / "<name>"` (get-documentation-for-story) returns the source of ONE story.

Each packet describes one `LOAD STORY` call, marked `>>> TARGET CALL`, with what the agent did before and
after it. The agent's private reasoning was not recorded. `AGENT SAYS` lines are the only first-person
evidence; everything else you must infer from what the agent had just seen and what it did next.

Your job: for every call in your batch file, reconstruct what information the agent wanted and why this
story looked like the place to get it. Be a careful historian: separate what is observed from what you
infer, and do not invent motives the packet does not support.

## Output

Write a JSON array to the output path you are given: one object per call, in the same order, with exactly
these fields.

- `call_id`: copied from the packet.
- `need`: ONE question, at most 30 words, that the agent wanted answered by this story. Be concrete about
  the component and the property or behaviour in question (e.g. "Does Button default to type=\"button\" or
  can it submit the surrounding form?").
- `trigger`: at most 30 words. The observation just before the call that created the need (e.g. "props
  table lists only label/error, but the app passes name/type/value to Input").
- `cue`: at most 25 words. What about THIS story (its name or listed description, compared with the other
  stories on offer) made it the one to load.
- `reason`: one paragraph, 60 to 110 words. Why the agent loaded this story at this moment: what it was
  working on, what it had just learned or failed to learn, what the story promised, and what it did with
  the answer. Write plainly. Mark inference with words like "probably" or "appears to".
- `evidence`: `"stated"` if an AGENT SAYS line near the call states the purpose of loading this story;
  `"partial"` if narration nearby gives the general purpose but not this story specifically;
  `"inferred"` if you had to reconstruct the purpose from actions alone.
- `evidence_quote`: the verbatim AGENT SAYS sentence you relied on, or null.
- `confidence`: `"high"`, `"medium"` or `"low"` — how sure you are that `need` is what the agent wanted.
- `outcome`: exactly one of
  - `"adopted"`: later code visibly follows a pattern, prop or composition shown in the story;
  - `"confirmed"`: the story confirmed what the agent already planned or believed; no visible change of course;
  - `"answered_negative"`: the story showed the wanted thing is absent or unsupported, and the agent went elsewhere (e.g. read the package source);
  - `"no_new_info"`: the story repeated what the agent already had;
  - `"unclear"`: the packet does not show what the agent did with it.
- `outcome_note`: at most 25 words of support for `outcome`.

## Rules

- Use only the packet. Do not guess which experiment or documentation variant a run came from.
- `exposure_before` tells you whether the agent had already seen this story's full source. If it had,
  ask yourself why it loaded it again, and say so.
- When several stories were loaded in one burst, give each its own `need` and `cue`; say in `reason` that
  they were loaded together.
- Calls from the same run share a `run_key`. Read a run's calls together, but annotate each separately.
- Keep `need`, `trigger` and `cue` free of filler. No bullet lists inside fields.
- The file must be valid JSON (double quotes, escaped newlines) and contain every call in the batch.

When done, reply with only: the number of calls annotated, and any call_ids you could not annotate and why.
