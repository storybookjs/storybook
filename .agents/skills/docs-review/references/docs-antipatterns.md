# Docs Antipatterns

Each antipattern includes the problem, how to recognize it, and what to do about it.

## 1. Background-First Opening

**Problem:** The page opens with history, motivation, or context before telling the reader what the page is about or what they will be able to do.

**Recognize it:** The first heading or paragraph talks about why something was built, how it evolved, or what problem it solves in the abstract — before stating what the feature *is*.

**Fix:** Open with what the thing is and what the reader can do with it. Move background to a later section or inline it where it supports a specific point.

## 2. Unseparated Mixed Doc Types

**Problem:** A single page interleaves explanatory prose, step-by-step instructions, and reference tables without clear sectional boundaries. The reader cannot scan for what they need.

**Recognize it:** The page alternates between doc type shapes *within the same sections* — e.g., conceptual paragraphs between procedure steps, or config tables dropped mid-narrative with no heading. There are no clear headings signaling a transition from one type of content to another.

**Not this antipattern:** A page with a clear primary type and well-separated secondary sections (each with its own heading and following its own type's shape) is fine. See "Common Secondary Sections" in `docs-strategy.md`.

**Fix:** Identify the primary doc type. For secondary content that belongs on this page, extract it into its own clearly headed section and ensure it follows its type's shape. For secondary content large enough to stand alone, recommend splitting into a separate page. The primary type determines the page's overall shape.

## 3. Edge Cases Before the Default Path

**Problem:** Exceptions, caveats, and special configurations appear before the reader sees the standard approach.

**Recognize it:** The first code example or instruction set handles a non-default scenario. Callouts with warnings appear before the basic usage.

**Fix:** Lead with the default path. Move edge cases, exceptions, and advanced configuration after the reader has seen the standard approach. Exception: safety-critical warnings that must precede action.

## 4. Technically Valid but Weak Examples

**Problem:** Code examples are syntactically correct but do not represent realistic usage. They teach the API surface without showing how a real project would use the feature.

**Recognize it:** Examples use placeholder names like `foo`/`bar`, show only the minimum required props, or demonstrate a feature in isolation from any meaningful context.

**Fix:** Replace with examples that reflect real usage patterns. Use realistic component names, props, and data. Show enough context that the reader can adapt the example to their own project.

## 5. Late Term Definition

**Problem:** A key term is used several times before it is defined. The reader must re-read earlier sections once they finally encounter the definition.

**Recognize it:** A Storybook-specific term (e.g., "decorator", "loader", "play function") appears in the opening paragraphs but is not defined or linked until later.

**Fix:** Define or link the term on first use. If the page is *about* the term, the opening sentence should define it.

## 6. Feature List Without Helping the Reader Act or Decide

**Problem:** The page lists what a feature can do without helping the reader understand when to use it, how to choose between options, or what to do next.

**Recognize it:** Bullet points or paragraphs describe capabilities ("X supports Y", "You can also Z") without connecting them to reader goals or decisions.

**Fix:** Frame capabilities around reader tasks or decisions. "Use X when you need Y" is more useful than "X supports Y."

## 7. Buried Procedure Outcome

**Problem:** A task page walks through steps but never states what the reader will have when they are done. The outcome is implied, not stated.

**Recognize it:** The procedure ends with the last step. There is no "you should now see…" or "this gives you…" summary.

**Fix:** State the expected outcome after the procedure. If possible, show what success looks like (a screenshot, a terminal output, or a description of the resulting behavior).

## 8. Preserving Weak Structure Because It Is "Clean"

**Problem:** A page has correct grammar, consistent formatting, and no broken links — but its structure does not serve the reader. A `maintenance` pass would miss the real issue.

**Recognize it:** The page feels polished but unhelpful. Readers would need to read the whole page to find what they need. Sections are ordered by implementation detail rather than reader need.

**Fix:** Escalate to `improve` or `rewrite`. Clean formatting is not a reason to preserve a page shape that does not work.

## 9. Overexplaining Basics While Underexplaining Storybook-Specific Behavior

**Problem:** The page spends space on concepts the target audience already knows (e.g., what a component is, how imports work) while glossing over Storybook-specific behavior that is actually confusing.

**Recognize it:** Paragraphs explaining general web development concepts sit alongside one-sentence descriptions of Storybook features that have no obvious analog.

**Fix:** Assume basic web development knowledge (HTML, CSS, JavaScript, components). Invest explanation space in Storybook-specific concepts, behaviors, and mental models.

## 10. Tightening Prose When Rewrite Is Actually Needed

**Problem:** Sentence-level edits are applied to a page whose fundamental organization is wrong. The page gets shorter and cleaner but remains unhelpful.

**Recognize it:** After a pass of prose tightening, the page still does not clearly serve its intended job. The reader's experience is not materially better.

**Fix:** Step back and diagnose at the page level. If the shape is wrong, restructure or rewrite — do not keep polishing.
