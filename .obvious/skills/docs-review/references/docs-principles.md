# Docs Principles

## North Star

Good documentation reduces **time-to-understanding** or **time-to-success** for the reader. Every edit, restructure, or rewrite should move the page closer to one of these outcomes.

## Dual-Reader Requirement

Storybook docs must work for two audiences simultaneously:

1. **Frontend developers** scanning for answers, examples, and steps they can act on immediately.
2. **LLMs and retrieval systems** that parse docs for accurate, structured information to surface in AI-assisted workflows.

Write for the human first. Structure for both.

## Quality Dimensions

Use these dimensions to evaluate whether a page is doing its job. They are ordered from most structural to most surface-level — fix the top of the list before polishing the bottom.

### 1. Intent Clarity

The page states what it will help the reader do or understand within the first two sentences. A reader (or retrieval system) can decide whether this page is relevant without scrolling.

### 2. Audience Fit

The page assumes the right level of prior knowledge. It does not over-explain web fundamentals or under-explain Storybook-specific behavior. It meets the reader where they are.

### 3. Information Shape

The page is organized around the reader's task or question, not around the feature's implementation. Sections follow a logical progression: context → action → result, or definition → usage → edge cases. When a page contains secondary sections of a different doc type, each section follows the progression appropriate to its own type.

### 4. Conceptual Clarity

Abstract ideas are grounded in concrete terms. Relationships between concepts are explicit. The reader can build a mental model, not just follow steps.

### 5. Task Usability

Procedures are complete, ordered, and testable. The reader can follow them without guessing at missing steps. The default path comes first; variations and edge cases follow.

### 6. Example Quality

Code examples are representative of real usage, not minimal to the point of being misleading. They demonstrate the concept or task the page is about, not just syntactic validity.

### 7. Economy

Every sentence earns its place. Redundant explanations, filler transitions, and throat-clearing preamble are removed. Brevity serves the reader — but not at the cost of clarity.
