# TEMPORARY FILE. We should delete this once we are done.

# Mealdrop known issues catalog (agentic-reference)

The inventory of defects present in the Mealdrop eval branches, split into
**planted** (deliberately introduced for the experiment) and **pre-existing**
(organic defects we verified and rely on). This file feeds the LLM judges
(SB-1695 misuse: fixed/left/introduced split; SB-1748 a11y baseline) and must
stay in this repo — never in the Mealdrop branches themselves, where an eval
agent could find it.

Fixture states are referenced by annotated tag, not branch head — code and
docs that pin a repo state (eval `ref` fields, line-anchored links) point at
the tag; when the branches move, cut `-v2` tags and update the pins in one
sweep. Current tags (pushed to yannbf/mealdrop; baseline includes the
"Tooling upgrades (#64)" rework — oxlint/oxfmt, dep majors, .nvmrc):

- `agentic-reference/original-v1` = `cedc246` (branch `agentic-reference/original`;
  plants + Storybook stripped)
- `agentic-reference/base-ui-v1` = `6865dfb` (branch `agentic-reference/base-ui`;
  themed Base UI — the Droppy design system proper comes later in M3; rebased
  onto the shared baseline as a single squashed commit, Storybook-free)

In eval `externalRepo.ref` fields use the unambiguous form
`refs/tags/agentic-reference/base-ui-v1` (codeload resolves it; verified).

Plant commits shared by both branches: `1671811` (Input aria-label),
`efc2029` (OrderSummary total color).

## Planted

| ID  | Where                                                              | Defect                                                                                                                                                                                                            | Branches | Detectable by                                 | Target scenario                         |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------- | --------------------------------------- |
| P-1 | `src/components/forms/Input.tsx`                                   | No accessible name on text inputs: `aria-label` removed; visible label's `htmlFor={id}` receives `undefined` from every checkout caller, so all 7 checkout fields are unnamed                                     | both     | axe `label` rule; a11y judge                  | a11y fix                                |
| P-2 | `src/components/forms/Input.tsx` (base only)                       | Misuse: uses the `@droppy/theme` stylesheet classes (`FieldRoot`/`FieldLabel`/`FieldError`) on raw markup instead of the Base UI `Field` parts, so label association and `aria-describedby` error wiring are lost | base     | misuse judge (component-usage guideline)      | a11y fix, migration reference           |
| P-3 | `src/components/ShoppingCart/OrderSummary/OrderSummary.styles.tsx` | Brand violation: order total hardcodes `#d70808` (palette red as a raw hex — bypasses color tokens, breaks dark mode)                                                                                             | both     | misuse judge (brand guideline); visual review | new page (reuse propagation), migration |

## Pre-existing (verified, kept deliberately)

| ID       | Where                                | Defect                                                                                                                                                                                                                                                    | Branches                             | Target scenario                                                                           |
| -------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| E-1      | whole app                            | No `<form>` element anywhere; checkout steps are `<div className="form">` with click-only buttons, so Enter never submits                                                                                                                                 | both                                 | bug fix (authentic, unplanted)                                                            |
| E-2      | `ContactDetails`/`DeliveryDetails`   | Validation errors are plain text: no `aria-describedby`, no live region, never announced                                                                                                                                                                  | both (on base, a consequence of P-2) | a11y fix                                                                                  |
| E-3      | `Input.tsx`                          | `autoComplete="off"` hardcoded on all checkout fields (WCAG 1.3.5)                                                                                                                                                                                        | both                                 | a11y fix                                                                                  |
| E-4      | `StepIndicator`                      | Step transition (Contact → Delivery) is visual-only; no announcement, no focus management                                                                                                                                                                 | both                                 | a11y fix                                                                                  |
| E-5      | `ShoppingCartMenu` + `forms/Select`  | Quantity is a `<select>` of 0–10 with `aria-label="{n} times"`; Select's label `htmlFor={id}` latent-undefined; the DS has a themed NumberField                                                                                                           | both                                 | rework (authentic, unplanted)                                                             |
| E-6      | `OrderSummary.styles.tsx`            | `border-top: 1px solid #f5f6f7` raw grey (equals `greyLight5` token); `EmptyMessageContainer` raw `font-size: 18px`                                                                                                                                       | both                                 | new page, migration                                                                       |
| E-7      | `SuccessPage`                        | Estimated delivery hardcoded to `13:23 today`; order state holds a single order, overwritten on each save, no persistence                                                                                                                                 | both                                 | new page (design seam)                                                                    |
| E-8      | `ContactDetails`                     | Phone validation only checks `value.length >= 10` — any 10+ character string passes (e.g. `asd@asd.com`); email and postcode have real regexes, phone doesn't                                                                                             | both                                 | none (organic realism)                                                                    |
| E-9      | `RestaurantCard.tsx:166`, `FoodItem` | Interactive cards are `<div onClick>` — no href, role, or tabindex; unreachable by keyboard, invisible to screen readers as controls (home, category, restaurant pages)                                                                                   | both                                 | migration; deliberately outside checkout so it doesn't collide with the a11y-fix scenario |
| E-10     | `app-state/cart/cart.ts:42`          | Setting cart quantity to 0 keeps the item as a €0.00 ghost row (checkout disables); the cart UI has no removal path                                                                                                                                       | both                                 | rework (authentic)                                                                        |
| E-11     | `Routes.tsx:26`                      | `/success` has no guard: direct visit or reload shows "Order confirmed!" with an empty order and €0.00 total (persistence facet of E-7)                                                                                                                   | both                                 | new page                                                                                  |
| ~~E-12~~ | `TopBanner.tsx`                      | FIXED by the tooling rework (prop renamed to transient `$inverted`) — no longer present on either branch; keep the ID reserved so old notes stay readable                                                                                                 | —                                    | —                                                                                         |
| E-13     | `Modal.tsx:33` (base only)           | Migrated food-item dialog closes visually but stays mounted with `role="dialog"` at opacity 0 (exit transition never completes), and `initialFocus` never runs — focus stays on `<body>` when it opens; the original's hand-rolled modal unmounts cleanly | base                                 | a11y-adjacent; migration regression — the original behaves correctly                      |
| E-14     | `Routes.tsx`                         | No catch-all route: unknown URLs render a fully blank page; footer links `/about` and `/login` are unrouted, so two in-app links lead to blank screens                                                                                                    | both                                 | none (organic realism)                                                                    |
| E-15     | `Routes.tsx:25`                      | `/checkout` reachable with an empty cart — the form renders next to "Your cart is empty" and an empty order can be completed through to `/success`                                                                                                        | both                                 | new page, bug fix adjacency                                                               |

## Judge-input notes

- Decision (Steve, 29 Jul): pre-existing issues stay in the baseline — "more
  stuff for the agent to pick up." Do not fix E-issues before recorded runs.
- Deliberate omission (Steve, 29 Jul): the a11y prompt names only the E-4
  (step transition) and E-3 (autocomplete) symptoms; P-1 (unnamed fields) and
  E-2 (unannounced errors) are intentionally unmentioned so runs that find
  them demonstrate discovery, not instruction-following. Judges must not
  penalize prompts-vs-fixes mismatches on those two.

- SB-1695: the "known pre-existing violations" list = P-2, P-3, E-5, E-6 (misuse
  scope). P-1/E-2/E-3/E-4 belong to the a11y judge's baseline, not misuse.
- SB-1748: run the a11y expert baseline on the untouched branch heads above so
  planted issues register as historical issues before recorded runs start.
- The a11y-fix prompt must only reference symptoms caused by P-1/E-2/E-3/E-4 —
  never E-1 (Enter submit), which is the bug-fix scenario's target; keeping the
  two defect sets disjoint is what keeps those cells uncontaminated.
