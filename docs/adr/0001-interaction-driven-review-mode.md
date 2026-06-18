# 1. Interaction-driven review mode

Date: 2026-06-18

## Status

Accepted

## Context

The Review feature lets an agent push a curated set of stories ("a review") into
Storybook. While reviewing, the manager enters a dedicated **review mode**: the
sidebar is filtered to the reviewed stories, the chrome is adjusted, and a
toolbar header provides previous/next navigation through the review.

A natural-but-wrong design is to infer review mode from the URL — e.g. treat any
`/review/` summary route or any `/story/...&collection=N` story route as "in
review mode". That couples a piece of **session state** (am I actively
reviewing?) to **routing**, which produces surprising behavior:

- Opening a deep link to a reviewed story would silently re-enter review mode and
  re-apply its sidebar filters, even when the user only wanted to look at that one
  story.
- Reloading or sharing a URL would resurrect a review session the user had
  dismissed.
- The "leave review" affordance becomes ambiguous: the route still looks like a
  review route after the user opts out.

## Decision

Review **mode** is **interaction-driven**, never inferred from the route.

- Entering and exiting review mode are explicit actions (auto-entered once on the
  first landing on a freshly-pushed summary, then driven by the nav interceptor,
  shortcuts, and dismiss). The active flag is persisted in `sessionStorage`
  (`storybook/review/review-mode`) so it survives reloads within a tab session.
- Routing helpers (`isReviewSummaryPath`, `parseStoryIdFromPath`, the
  `collection` query param) only describe _where_ the user is, never _whether_
  they are reviewing. They are pure functions with no side effects on mode.
- When review mode is entered, the pre-review sidebar filters and chrome are
  snapshotted so the exact prior layout is restored on exit.

## Consequences

- Deep links to a reviewed story render that story normally without hijacking the
  sidebar; review mode is only active if the user actually entered it.
- Dismissing a review returns the user to their pre-review canvas and clears the
  persisted flag, so the session does not reappear on the next navigation.
- The route and the mode can be reasoned about independently, which keeps the
  routing layer free of review-specific state and keeps mode transitions in one
  place.
