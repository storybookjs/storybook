# Story loads: every call and its reconstructed reason

285 `get-documentation-for-story` calls from 650 current runs, grouped by reason cluster. Reasons are reconstructed by an annotator from the transcript; `evidence` says how directly the agent stated its purpose. The same rows are in `story-loads.csv`.

## Family: worked-example

### example-model — Model the UI on an in-app example (72 calls)

The design system ships a story depicting the very piece of app UI the agent is building or changing. The agent loads it to see how the design system itself composes that UI: which components and props, layout, primary versus secondary emphasis, labels, how state or progress is presented.

#### c154 · stories-full · 701 · Modal / "Mealdrop Food Item Modal"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-19T23-44-55.651Z/701-new-ui-flow/run-6` · story call 1 of 1 in the run · tool call 31 of 130 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does Droppy's real Mealdrop modal arrange content inside Modal (heading, body, quantity control, action buttons) and size itself?

**Reason.** Still researching before any edit, the agent had to build a Get help modal with selectable choices and a confirmation for the Order History page. It had fetched docs for several components and was grepping the package's CSS tokens. It appears to have loaded this story to see a complete, realistic Modal composition it could model its own dialog on. The story returned only a one-line wrapper, `<FoodItemModal container={args.container} />`, with no markup. The agent then went to the package itself, grepping `droppy-Modal` class names and CSS, and later wrote an OrderModal wrapper that overrides the fixed desktop dialog size.

#### c036 · full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-full-opus-high/2026-08-19T19-34-51.695Z/702-rework-ui-flow/run-1` · story call 1 of 1 in the run · tool call 11 of 46 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's cart-line example lay out and wire a QuantityStepper per dish (bounds, label, removal)?

**Reason.** The task was to make quantity controls consistent between the dish modal and the basket. The agent had read both UIs, the cart state, and the QuantityStepper, Select and choosing-components docs. The QuantityStepper listing included a story described as cart lines with per-dish steppers, which probably looked like a ready-made pattern for the basket row it was about to rebuild. The agent loaded it, apparently to copy its layout and props. The source was only a `<CartLines />` wrapper, so nothing new was learned, and the agent went back to grepping the app and reading other component docs.

#### c037 · full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-full-opus-high/2026-08-19T19-34-51.695Z/702-rework-ui-flow/run-2` · story call 1 of 1 in the run · tool call 10 of 28 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system compose a basket line around a per-dish QuantityStepper (layout, props, labelling)?

**Reason.** The agent had read the choosing-components guidance and both quantity UIs, and had just fetched the QuantityStepper docs. Three basic stories were shown in full; the rest were listed with one-line descriptions. This one described the very thing it was about to build, a basket line with its own stepper, so it probably wanted a reference to copy. The story returned only `<CartLines />` with the helper hidden. The agent carried on reading the app's cart wiring and the Select, Button and Icon docs, so the design appears to have come from elsewhere.

> Now let me look at the two UIs and the design system guidance.

#### c038 · full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-full-opus-high/2026-08-19T19-34-51.695Z/702-rework-ui-flow/run-4` · story call 1 of 1 in the run · tool call 10 of 29 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does Droppy lay out a cart line with a QuantityStepper: which props, label and surrounding text?

**Reason.** The agent had located both quantity controls, read the QuantityStepper docs, the basket's Select-based menu, the choosing-components guide and the cart reducer. With the direction apparently set, to bring the basket in line with the stepper, it loaded the "Mealdrop Cart Line" story, probably for a ready composition of a cart row with a stepper to model its edit on. The story returned just `<CartLines />`, a helper with hidden markup, and an import list. The agent carried on reading the header, the Icon and Button docs and the app's food item code; the packet shows no edit.

#### c039 · full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-full-opus-high/2026-08-19T19-34-51.695Z/702-rework-ui-flow/run-5` · story call 1 of 1 in the run · tool call 8 of 27 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system compose a basket line around a per-dish QuantityStepper (layout, props, labelling)?

**Reason.** The agent had located both quantity UIs, read the choosing-components guidance and fetched the QuantityStepper docs. Among the stories listed without source, this one was described as cart lines with per-dish steppers, which is the basket it was about to convert from a Select. It probably wanted the reference layout and props for such a line. The story returned only `<CartLines />`, with the helper hidden. The agent then read the order summary, cart state and header wiring, searched for remove actions, and consulted Select, Icon and Button docs, apparently designing the line itself.

#### c057 · full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-full-opus-high/2026-08-19T21-42-00.870Z/702-rework-ui-flow/run-2` · story call 1 of 1 in the run · tool call 12 of 39 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's cart-line example use QuantityStepper per dish (props, bounds, layout) in a cart?

**Reason.** The agent was reviewing both quantity UIs and the design system's guidance. It had read the choosing-components page, the cart's Select-based menu and cart state, then the QuantityStepper and Select docs. The stepper docs described this story as cart lines with per-dish quantity steppers, so it probably looked like a ready example of the stepper in the cart context the task concerns. The response was only an opaque CartLines element with no usable JSX. The agent continued by tracing cart actions in the app, reading Icon and Button docs and inspecting the stepper's implementation.

> Now let me review both quantity UIs and the design system guidance.

#### c058 · full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-full-opus-high/2026-08-19T21-42-00.870Z/702-rework-ui-flow/run-5` · story call 1 of 1 in the run · tool call 8 of 30 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** How does the design system's reference cart line wire up QuantityStepper for each dish, so the basket can follow it?

**Reason.** The agent had found the inconsistency (stepper in the dish modal, Select in the basket) and read the choosing-components page and QuantityStepper docs. It said the design system was explicit and that it would check the reference story and the cart state. This story was the listed example of steppers in cart lines, so it promised a pattern for the basket rows. The returned source was only a `<CartLines />` wrapper, with no markup. The agent went on to read the cart slice and header, then rewrote the basket with QuantityStepper using the bounds already used in the dish modal.

> Let me check the reference story and the cart state handling.

#### c102 · purge-jsdoc · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-35-09.397Z/702-rework-ui-flow/run-1` · story call 1 of 1 in the run · tool call 8 of 23 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does Droppy's Mealdrop cart-line example use QuantityStepper for each dish: props, bounds and row layout?

**Reason.** The agent was aligning the two quantity controls and had read both UIs, the 'Choosing components' page and the QuantityStepper docs. Only Default, Value and Min had source; the cart-line story was listed with a description that matches the basket sidebar it needed to change. Without narration, it seems the agent wanted a concrete cart-row composition to follow. The story returned just <CartLines />, with imports hinting at Body, Heading and Separator. The agent went back to the cart reducer, Header, FoodItem and the Select, Button and Icon docs; the packet shows no later edit naming the component.

#### c103 · purge-jsdoc · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-35-09.397Z/702-rework-ui-flow/run-10` · story call 1 of 1 in the run · tool call 8 of 33 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does Droppy's own Mealdrop cart line wire a QuantityStepper per dish (value/onChange, min, aria-label, removal), so the basket can copy it?

**Reason.** The agent was reconciling two quantity controls in MealDrop: the dish modal already used QuantityStepper and the basket sidebar used a Select. It had just read the 'Choosing components' page and the QuantityStepper docs, where only Default, Value and Min came with source. It appears to have loaded the cart-line story, the one example set in the same screen it was about to edit, to see a real cart-row composition. The story returned only an opaque <CartLines /> wrapper, so the agent turned to the cart state, Header wiring and Button/Icon docs, and later rewrote ShoppingCartMenu with QuantityStepper.

#### c104 · purge-jsdoc · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-35-09.397Z/702-rework-ui-flow/run-2` · story call 1 of 1 in the run · tool call 7 of 49 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** How does the design system's cart-line example wire QuantityStepper into a cart row (props, bounds, labelling, layout)?

**Reason.** The agent had confirmed the two modalities, QuantityStepper in the food modal and Select in the cart, and read the choosing-components guidance, which it took as saying the same job should use the same component and that QuantityStepper fits small bounded counts. It then said it would check the cart-line story, whose description promised cart lines with per-dish steppers, presumably as the template for the cart change. The response was only an opaque CartLines element. The agent moved on to the cart state, the Select docs and the app's cart components.

> Let me check the cart-line story and the cart state semantics.

#### c105 · purge-jsdoc · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-35-09.397Z/702-rework-ui-flow/run-3` · story call 1 of 1 in the run · tool call 17 of 25 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does Droppy's own cart line lay out QuantityStepper beside the dish name and price, and with which props?

**Reason.** The agent had found the inconsistency: the basket sidebar used a Select, the dish modal a QuantityStepper. After reading the cart code, the Header wiring and the Icon and Button docs, it loaded the stepper's "Mealdrop Cart Line" story, apparently to copy how the design system composes a cart row with a stepper. The story returned only `<CartLines />`, a helper whose body was not shown, plus its imports. The agent then said it had what it needed, quoting guideline text rather than the story, and rewrote the basket with QuantityStepper using its own layout.

> Now I have what I need.

#### c106 · purge-jsdoc · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-35-09.397Z/702-rework-ui-flow/run-4` · story call 1 of 1 in the run · tool call 9 of 37 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** What does a Mealdrop cart line built with QuantityStepper look like in code: the props per dish and the surrounding row layout?

**Reason.** Working on the quantity-control consistency task, the agent had reviewed the basket sidebar (a Select) and the dish modal (QuantityStepper), then read the 'Choosing components' guidance and the QuantityStepper docs. With no narration at this point, the purpose is inferred: it probably wanted the design system's reference composition for a basket row before replacing the Select. The story came back as a bare <CartLines /> wrapper with an import line, so nothing could be copied. The agent went on to inspect cart state, the Header wiring and Button docs, and later wrote ShoppingCartMenu with QuantityStepper.

#### c107 · purge-jsdoc · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-35-09.397Z/702-rework-ui-flow/run-5` · story call 1 of 1 in the run · tool call 10 of 53 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does Droppy's cart-line example lay out and wire QuantityStepper for each dish in the basket?

**Reason.** The agent had read the Choosing components guide, both quantity UIs and the stepper docs, which showed three basic stories and listed this one with a short description. Having seen that the basket uses a Select where the dish modal uses a stepper, it probably wanted the design system's own cart row as a model for the basket change. The story returned only `<CartLines />`, so it gave the imports but no markup. The agent carried on from the docs it had, inspecting app usages and fetching Icon and Button docs, and later rewrote the cart menu with QuantityStepper in place of Select.

#### c108 · purge-jsdoc · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-35-09.397Z/702-rework-ui-flow/run-6` · story call 1 of 1 in the run · tool call 7 of 27 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's own cart-line example place and configure QuantityStepper for each dish in the basket?

**Reason.** The agent had explored both quantity UIs and fetched only the QuantityStepper docs so far. Among the listed stories, one was described as cart lines with per-dish quantity steppers, which appears to answer directly which control the design system expects in a basket and how to wire it. The agent loaded it straight away, probably to use as a template for the basket row. The source was a `<CartLines />` wrapper with no markup. The agent then read the choosing-components guidance page, the cart state and header code, and further component docs before editing.

#### c109 · purge-jsdoc · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-35-09.397Z/702-rework-ui-flow/run-7` · story call 1 of 1 in the run · tool call 7 of 36 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** How does Droppy's cart-line example use QuantityStepper per dish, as a reference for the basket's quantity control?

**Reason.** The agent had located both quantity UIs, a QuantityStepper in the dish modal and a Select in the basket, and had just read the stepper docs. It said it would check the guidance on choosing between the components plus the cart-line story, so the purpose was to see the design system's own basket row before deciding which control to standardise on. The story returned only `<CartLines />` under the description it had already read, so it added no markup or props. The agent read the Choosing components guide in the same step and then examined the cart state and header code.

> Let me check the design system's guidance on choosing between these, plus the cart-line story and the cart state logic.

#### c110 · purge-jsdoc · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-35-09.397Z/702-rework-ui-flow/run-8` · story call 1 of 1 in the run · tool call 9 of 39 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does Droppy's cart-line example set out QuantityStepper beside each dish, and with what bounds and label?

**Reason.** The agent had read both quantity UIs, the Choosing components guide and the stepper docs, which listed this story with a one-line description. Knowing the basket uses a Select while the dish modal uses a stepper, it probably wanted to see the design system's own cart row before changing the basket: how the stepper sits beside name and price, and what bounds and label it gets. The story returned only `<CartLines />`, so nothing beyond the description. The agent went back to the app, tracing how the cart menu is used, then read Button docs and the technical guidelines, and rewrote the cart menu with QuantityStepper.

#### c111 · purge-jsdoc · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-35-09.397Z/702-rework-ui-flow/run-9` · story call 1 of 1 in the run · tool call 8 of 37 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** How does the cart-line example use QuantityStepper for each dish, and what happens at the lower bound (removing a dish at quantity 0)?

**Reason.** The agent had found the inconsistency (QuantityStepper in the restaurant modal, Select in the basket) and read the guidance saying both places must use the same control. It then said it would check the cart-line example story and how quantity 0 is handled today, so the load was meant to show the reference basket row, probably including how removal works when min is 1. The story returned only a <CartLines /> wrapper. The agent read the cart reducer for the zero case, checked Select, Button and Icon docs for a separate remove affordance, and then rewrote ShoppingCartMenu with QuantityStepper.

> Let me check the cart-line example story and how quantity 0 is handled today.

#### c180 · stories-full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-10` · story call 1 of 3 in the run · tool call 9 of 32 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system build a basket line with QuantityStepper, as a model for replacing the basket's Select?

**Reason.** The agent had read both quantity UIs and fetched the QuantityStepper and Select docs. It loaded this story first of three, before any edit, most likely looking for the design system's own basket line to copy when replacing the Select. The story returned only `<CartLines />` with the helper hidden. The agent then tried NumberField docs, the component browser page, the stepper's Anatomy and Select's MealDrop story, and finally searched the installed package for docs, which suggests it was still hunting for usage guidance. Its later edit swaps Select for QuantityStepper in ShoppingCartMenu.

#### c183 · stories-full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-2` · story call 1 of 3 in the run · tool call 9 of 35 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system itself build a basket line around QuantityStepper, as a model for replacing the basket's Select?

**Reason.** The agent had just found that the dish modal uses QuantityStepper while the basket sidebar uses a Select, and said it would fetch design-system guidance. The stepper docs showed three basic stories in full and listed the rest by name. This story's name matched the basket line it was about to rework, so it probably hoped for a reference composition. The returned source was only a `<CartLines />` wrapper with the helper hidden, so nothing usable came back and it went on to the Select and NumberField docs. Two more stepper stories were loaded later in the same run.

> Let me read the basket and fetch the design system guidance.

#### c191 · stories-full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-5` · story call 1 of 3 in the run · tool call 8 of 38 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system itself show quantity changes in a cart line with QuantityStepper, and with what layout?

**Reason.** The agent had read both quantity UIs and fetched QuantityStepper and Select docs, which showed three basic stories each and listed the rest by name. It then loaded this story and Select's Mealdrop story together, apparently to compare how the design system uses each control in a real Mealdrop screen. The cart-line story looked like direct evidence for what belongs in the basket. It returned only `<CartLines />`. The agent went on to the component browser page, the stepper's Anatomy story and then the package README and typings, and finally replaced Select with QuantityStepper in the cart menu.

#### c194 · stories-full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-6` · story call 1 of 2 in the run · tool call 8 of 45 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's cart-line example use QuantityStepper for per-item quantities (props, bounds, row layout)?

**Reason.** The agent had found the two quantity UIs: QuantityStepper in the dish modal and a Select in the cart sidebar. After fetching the QuantityStepper and Select docs it loaded this story, apparently because its name describes a stepper inside a Mealdrop cart line, which is the arrangement the task would move the cart towards. It was loaded together with Anatomy. No narration states the purpose. The response was a single opaque CartLines element, so nothing about props or layout was learned; the agent tried Anatomy next, then NumberField docs, the package README and typings.

#### c196 · stories-full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-7` · story call 1 of 4 in the run · tool call 8 of 34 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's cart-line example use QuantityStepper in a cart row (props, bounds, layout)?

**Reason.** The agent had spotted QuantityStepper in the component list, read the dish modal and cart item code, and fetched the stepper's docs. A story named Mealdrop Cart Line apparently looked like the design system's own picture of a stepper in the cart, which is where the app's interaction differs. No narration states this. It was the first of four QuantityStepper stories loaded during this research phase. The response was a single opaque CartLines element, so the agent went back to reading the app's cart components, cart state and the Select docs.

#### c059 · full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-full-opus-high/2026-08-19T23-05-41.335Z/704-fix-a11y-flow/run-1` · story call 1 of 1 in the run · tool call 10 of 44 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `high` · outcome `no_new_info`

**Need.** How does the design system's reference checkout step indicator use ProgressBar to expose the current step to assistive technology?

**Reason.** The agent was investigating why screen-reader users cannot tell the checkout has moved to delivery details. It had read the multi-step form and step indicator, then said it would check the docs for relevant components and accessibility guidance, fetching ProgressBar, Input and the accessibility guidelines. The ProgressBar docs listed a story for Mealdrop's own checkout steps, which promised a reference for labelling and announcing step progress. The returned source was just `<CheckoutStepIndicator />`, with no markup. The agent moved on to searching the app for live regions and trying to run the flow in a browser.

> Now let me check the design system docs for the relevant components and accessibility guidance.

#### c060 · full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-full-opus-high/2026-08-19T23-05-41.335Z/704-fix-a11y-flow/run-3` · story call 1 of 2 in the run · tool call 8 of 62 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's reference checkout step indicator combine ProgressBar with visible step text and an accessible label?

**Reason.** The agent was fixing checkout accessibility, including users not noticing the move from contact to delivery details. It had read the checkout components, then fetched ProgressBar and Input docs. The ProgressBar listing offered one story described as Mealdrop's checkout step indicator, which probably looked like a reference implementation of the very component being repaired. The agent loaded it, apparently to see how the bar is labelled and paired with step text. The source was only a `<CheckoutStepIndicator />` wrapper with no markup, so the agent turned to the accessibility guidelines and then the package's type declarations and compiled code.

#### c063 · full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-full-opus-high/2026-08-19T23-05-41.335Z/704-fix-a11y-flow/run-6` · story call 1 of 1 in the run · tool call 11 of 55 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does Mealdrop's reference checkout step indicator use ProgressBar: its label, value/max and the visible step text?

**Reason.** The agent had read the checkout flow, then the ProgressBar, Input, accessibility-guideline and Button docs, saying two root causes were already confirmed. Before editing it loaded this story, the only ProgressBar example placed in the checkout, probably to copy how the design system labels the bar and words the step text. What came back was a single <CheckoutStepIndicator /> wrapper with an import line. The agent then checked that the package exports ProgressBar, read its declaration in index.d.ts and looked at Input and Button internals. The packet shows no later edit, so the eventual use is not visible.

> Let me fetch the design system docs for the relevant components.

#### c065 · full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-full-opus-high/2026-08-19T23-05-41.335Z/704-fix-a11y-flow/run-8` · story call 1 of 2 in the run · tool call 13 of 59 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How is ProgressBar used in Droppy's Mealdrop checkout step indicator: label text, value/max per step, and accompanying heading or body copy?

**Reason.** In the accessibility task the agent had read the multi-step form, the ProgressBar, Input, Heading and Button docs and the accessibility guidelines, and was checking how the app styles its form wrapper. It then loaded this story, apparently to see how the design system itself builds the checkout step indicator before replacing the hand-rolled bar. It was loaded in the same stretch as Button's 'Test Defaults To Type Button'. The result was only a <CheckoutStepIndicator /> wrapper. The agent compared ProgressBar's CSS in the package with the old bar, noted visual parity, and wrote StepIndicator with ProgressBar, Heading and Body.

> Let me fetch the relevant design system docs.

#### c127 · purge-jsdoc · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-55-56.178Z/704-fix-a11y-flow/run-1` · story call 1 of 1 in the run · tool call 16 of 48 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's checkout step indicator use ProgressBar and label it so the current step reaches screen-reader users?

**Reason.** The agent was collecting material for the checkout accessibility fixes: accessibility guidelines, ProgressBar, Heading, Button and ErrorBlock docs, plus a grep of the app for live regions and autocomplete. It then loaded this story, the only one in its run, probably to see how the design system's own step indicator labels and announces progress between steps. The source was just `<CheckoutStepIndicator />` with the helper hidden. Afterwards the agent dug into the package's type declarations, CSS and JS for Heading, ProgressBar, Input and Button, which suggests it had to work the answer out from the implementation.

#### c131 · purge-jsdoc · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-55-56.178Z/704-fix-a11y-flow/run-5` · story call 1 of 2 in the run · tool call 11 of 50 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does Droppy's checkout step indicator present the current step with ProgressBar, its `label` and accompanying text?

**Reason.** The agent had read the checkout forms and step indicator and said it would check the docs for the relevant components. It fetched Input, the accessibility guidelines, ProgressBar and the separate Progress component. ProgressBar's list included a story described as Mealdrop's checkout step indicator, which it loaded first, followed at once by Input's checkout-form story. It probably wanted the reference markup for conveying step progress. The story gave only `<CheckoutStepIndicator />` and imports. The agent continued through app styles and the Button, Heading and Body docs, then said it had what it needed and rewrote StepIndicator.

> Now let me check the design system docs for the relevant components.

#### c133 · purge-jsdoc · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-55-56.178Z/704-fix-a11y-flow/run-6` · story call 1 of 2 in the run · tool call 14 of 38 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does Droppy's reference checkout step indicator use ProgressBar, including its accessible label and the step wording?

**Reason.** The agent was investigating why assistive-technology users miss the move to delivery details. It had read the checkout components, the Input and ProgressBar docs, the accessibility guidelines, global styles and Heading docs. It then loaded the two Mealdrop checkout examples back to back, this one first and Input's 'Mealdrop Checkout Form' second, apparently to see the design system's own version of the screens. This story returned only a <CheckoutStepIndicator /> wrapper. The agent continued with test setup, Button docs and package exports, and later rebuilt StepIndicator on a styled ProgressBar with useId and a ref.

#### c135 · purge-jsdoc · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-55-56.178Z/704-fix-a11y-flow/run-7` · story call 1 of 3 in the run · tool call 12 of 41 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's checkout step indicator use ProgressBar and label it so the current step reaches screen-reader users?

**Reason.** Before any edit, the agent had read the checkout components, the accessibility guidelines and the docs for Input, ProgressBar and Progress, and had grepped the app for live regions and autocomplete. With the step-change complaint in mind, it probably wanted the design system's reference for the step indicator, in particular how ProgressBar is labelled. The story returned only `<CheckoutStepIndicator />`; its imports hint at Heading and Body beside the bar, but the helper is hidden. The agent moved on to Button docs and two more stories, and later rewrote StepIndicator.tsx on its own.

#### c137 · purge-jsdoc · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-55-56.178Z/704-fix-a11y-flow/run-7` · story call 3 of 3 in the run · tool call 15 of 41 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `confirmed` · coders split: example-form-wiring, example-model, example-model

**Need.** How does the design system's reference checkout form structure its two steps: form element, sections, headings and Input error messages?

**Reason.** Third story in a short run of loads before editing. The Input docs already said native props pass straight through, so the agent probably wanted the overall shape of the reference form rather than a prop detail. The story showed a `<form>` with one section per step, each under a `Heading level={3} size={4}`, and Inputs carrying label and error text. The agent next fetched Heading and Body docs, checked the app's `.form` styles, and then wrote a step-form hook built around a submit event. Since it had checked Button's type default beforehand, the story appears to have confirmed a plan already forming.

#### c233 · stories-full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-1` · story call 2 of 5 in the run · tool call 9 of 56 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `high` · outcome `answered_negative`

**Need.** How does the design system's checkout step example use ProgressBar to tell users which step they are on?

**Reason.** Loaded in the same burst as the Input checkout-form story, right after the agent fetched Input and ProgressBar docs. One complaint was that users cannot tell the page has moved on to delivery details, and the app shows progress through a step indicator. The agent appears to have wanted the reference implementation of that indicator, including how ProgressBar is labelled. The source returned was only `<CheckoutStepIndicator />`. The agent then opened the design-system package, loaded Input's Anatomy story, and read ProgressBarProps and the compiled ProgressBar code.

> Now let me check the design system docs for the components involved.

#### c238 · stories-full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-10` · story call 2 of 8 in the run · tool call 9 of 57 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's checkout step indicator use ProgressBar to convey the current step (value, max, label)?

**Reason.** Loaded right after Input's Mealdrop Checkout Form, in the same burst, while the agent collected docs for components used in checkout. One complaint was that users cannot tell when the page moves on to delivery details, and the app has a step indicator. A ProgressBar story named after checkout steps probably looked like the design system's reference for conveying the current step. The response was a single opaque CheckoutStepIndicator element with no usage details. The agent then located the package's typings, and later loaded two more ProgressBar stories and read the Progress implementation.

> Now let me fetch the design system docs for the relevant components.

#### c246 · stories-full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-2` · story call 2 of 2 in the run · tool call 9 of 43 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's checkout step indicator use ProgressBar, and does it tell assistive technology which step is current?

**Reason.** Loaded directly after the Input checkout-form story, as part of the agent's check of design-system APIs before editing. The other complaint was that users cannot tell the page has moved to delivery details, and the app has its own StepIndicator, so the agent probably wanted the design system's reference for labelling and announcing the current step. The story returned only `<CheckoutStepIndicator />`. The agent turned to Button docs and the package's declarations and bundled code, and later rewrote StepIndicator.tsx with a focusable step heading, a solution not derivable from this story.

> Let me check the design system APIs before changing anything.

#### c248 · stories-full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-3` · story call 2 of 4 in the run · tool call 10 of 56 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does the reference checkout step indicator label ProgressBar and present the current step so a step change is perceivable?

**Reason.** Loaded immediately after the Input checkout-form story, as part of the same burst. The task says users cannot tell the page has moved on to delivery details, and the app's StepIndicator is built on ProgressBar, whose props table showed value, max, label and className. The agent probably wanted the design system's own step-indicator composition to see how the bar is named and how the step is communicated. The source was only a `<CheckoutStepIndicator />` wrapper. The agent then listed the package's type declarations and read the ProgressBar implementation in dist, and later rewrote StepIndicator.tsx itself.

> Let me check the design system docs and existing tests.

#### c252 · stories-full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-4` · story call 2 of 6 in the run · tool call 10 of 63 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's checkout step indicator use ProgressBar, and does it tell assistive technology which step is current?

**Reason.** Loaded in the same burst as the Input checkout-form story, straight after the agent fetched Input and ProgressBar docs. One complaint was that people cannot tell the checkout has moved to delivery details, and the app has its own StepIndicator, so the agent probably wanted the design system's reference for showing and announcing step progress. The story returned only a `<CheckoutStepIndicator />` wrapper with the helper's code hidden. Nothing could be taken from it; the agent continued with two more Input stories and then turned to the package source.

> Now let me fetch the design system docs for the components involved.

#### c258 · stories-full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-5` · story call 2 of 5 in the run · tool call 9 of 62 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** How does Droppy's checkout step indicator use ProgressBar and surrounding text to tell users which step they are on?

**Reason.** Loaded in the same burst as Input's "Mealdrop Checkout Form", straight after the agent fetched the Input and ProgressBar docs. One complaint is that users cannot tell the checkout has moved on to delivery details, and the agent had just read the app's StepIndicator, so it appears to have wanted the design system's own checkout-steps example. The story returned only `<CheckoutStepIndicator />`, a helper with its markup hidden, plus an import list. The agent then went looking for the package on disk and read the Input and ProgressBar declarations in index.d.ts.

> Now let me check the design system docs for the relevant components.

#### c263 · stories-full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-6` · story call 2 of 4 in the run · tool call 9 of 62 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's checkout step indicator use ProgressBar: which value, max and label, and what text sits beside it?

**Reason.** The agent was collecting documentation for the checkout components and had just loaded Input's 'Mealdrop Checkout Form'; this was the second of the two checkout examples loaded back to back. The app has a hand-rolled StepIndicator, and the complaint is that step changes go unnoticed, so the agent probably wanted the reference way to label and announce progress with ProgressBar. The story returned only a <CheckoutStepIndicator /> wrapper. The agent then read the package's type declarations for Input and ProgressBar, and later rewrote StepIndicator with ProgressBar, Heading and Body plus a ref.

> Let me fetch docs for the components in play.

#### c267 · stories-full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-7` · story call 2 of 4 in the run · tool call 10 of 77 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's checkout step indicator use ProgressBar, and does it tell assistive technology which step is current?

**Reason.** Loaded straight after the Input checkout-form story, as part of the agent's pass over docs for the components checkout uses. One complaint is that users cannot tell when the page moves to delivery details, and the app has its own StepIndicator, so the agent probably wanted to see how the design system's reference indicator names and announces the current step. Only `<CheckoutStepIndicator />` came back, with the helper hidden. The agent went to the package's declarations for Input and ProgressBar, later loaded ProgressBar's Label story, and eventually rewrote StepIndicator with a forwarded ref.

> Now let me check the design system docs for the relevant components, and look for existing a11y patterns in the app.

#### c273 · stories-full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-8` · story call 4 of 4 in the run · tool call 19 of 74 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `answered_negative`

**Need.** How does Droppy's own checkout step indicator combine ProgressBar with a heading and step text so the current step is conveyed?

**Reason.** Having dealt with Input, the agent turned to the complaint that users cannot tell the page has moved to delivery details. It had fetched the Heading docs and was grepping the Heading and ProgressBar declarations when it loaded this story, the last of four in the run. It probably wanted the design system's reference composition for a checkout step indicator. The story returned only `<CheckoutStepIndicator />`, a helper whose markup was hidden. The agent went straight back to the package, reading ProgressBarProps and the `role="progressbar"` implementation, and later rewrote StepIndicator with Body, Heading and ProgressBar.

#### c276 · stories-full · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-9` · story call 3 of 6 in the run · tool call 15 of 70 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `high` · outcome `no_new_info`

**Need.** How does Droppy's checkout step indicator use ProgressBar to tell users which step they are on?

**Reason.** After checking Input, the agent turned to the complaint that users cannot tell the checkout has moved to delivery details. The app has a step indicator, and the ProgressBar docs listed a story named after Mealdrop's checkout steps, so it probably expected a reference implementation showing how the step is labelled and exposed. The source was only an opaque CheckoutStepIndicator helper. The agent immediately loaded a ProgressBar test story about announcements, then started the app to inspect it directly. It later rewrote the step indicator around ProgressBar, after also reading ProgressBar's compiled source.

#### c025 · full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-full-opus-high/2026-08-19T16-27-17.534Z/706-new-ui-scheduled-flow/run-1` · story call 1 of 1 in the run · tool call 16 of 74 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `unclear`

**Need.** How are primary and secondary Buttons composed in MealDrop's cart panel footer, where "Schedule delivery" must join "Order now"?

**Reason.** After reading the cart menu, header, checkout page and restaurant data, the agent announced it would fetch docs for the components it needed and pulled Button and Sidebar. The first task item is a secondary "Schedule delivery" button beside a primary "Order now" in the sidebar cart, and Button's list included a story for the action stack in Mealdrop's cart panel. It probably loaded it to see the sanctioned pairing and layout. The story showed a `large` primary above a `clear` secondary in a grid. The packet shows only further docs and token reading afterwards.

> Now let me fetch the design system documentation for the components I'll need.

#### c026 · full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-full-opus-high/2026-08-19T16-27-17.534Z/706-new-ui-scheduled-flow/run-10` · story call 1 of 2 in the run · tool call 27 of 92 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How does Droppy's cart panel pair a primary checkout Button with a secondary one, in props and layout?

**Reason.** Late in a long research phase, after reading docs for several components and Button's implementation and typings in the package, the agent loaded this story together with Sidebar's cart-panel story just before starting to implement. The task puts a secondary "Schedule delivery" button beside the primary "Order now" in the cart footer, and this story is described as that panel's action stack, so it probably served as the reference for props and spacing. It shows a large cart-icon button above a clear button in a 0.5rem grid. Later edits import Button, but the visible snippets do not show the footer.

#### c027 · full · 706 · Sidebar / "Mealdrop Cart Panel"

`results/agentic-ref-cc-full-opus-high/2026-08-19T16-27-17.534Z/706-new-ui-scheduled-flow/run-10` · story call 2 of 2 in the run · tool call 28 of 92 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does Droppy's reference cart panel compose Sidebar: what goes in children and footer, and where do the action buttons sit?

**Reason.** Loaded together with Button's checkout-actions story just before the agent began implementing. The scheduling flow has to live inside the cart sidebar, so the agent probably wanted the design system's reference cart panel to see how content and the pinned footer are composed. The story returned a single line, `<ShoppingCartMenu container={args.container} />`: a wrapper around a component with the same name and imports as the app's own cart menu, which the agent had probably already read. It gave no new markup. The agent went on to read global styles and then wrote types, scheduling helpers and a rewritten ShoppingCartMenu.

#### c028 · full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-full-opus-high/2026-08-19T16-27-17.534Z/706-new-ui-scheduled-flow/run-2` · story call 1 of 1 in the run · tool call 17 of 94 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** What Button variants and layout does Droppy use for the cart panel's actions, to place "Schedule delivery" beside "Order now"?

**Reason.** The agent was still gathering context for scheduled delivery: it had read the cart menu, header, restaurant data and the food item modal, then fetched the Sidebar docs, Button docs and the technical guidelines. The brief asks for a secondary "Schedule delivery" button next to a primary "Order now" in the sidebar cart. Button's list included a story for the action stack in Mealdrop's cart panel, which it loaded, probably to see how the design system pairs a primary and a secondary action there. It showed a `large` button over a `clear` one. Afterwards the packet shows only docs and token lookups.

#### c029 · full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-full-opus-high/2026-08-19T16-27-17.534Z/706-new-ui-scheduled-flow/run-3` · story call 1 of 1 in the run · tool call 14 of 78 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `high` · outcome `unclear`

**Need.** How does Droppy's own cart panel stack its primary and secondary Buttons: which props distinguish them and how are they laid out?

**Reason.** The agent had finished reading the cart sidebar, checkout and order code and had just fetched the Button docs. The task asks for a primary and a secondary button side by side in the cart footer, and Button has no variant prop, only boolean flags. This story was described as the cart panel's own action stack, so it probably looked like a ready-made reference for pairing the two buttons. It showed a large icon button above a clear one in a grid. The agent then moved on to Sidebar, typography and guideline docs; the footer edit itself is not shown.

#### c030 · full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-full-opus-high/2026-08-19T16-27-17.534Z/706-new-ui-scheduled-flow/run-4` · story call 1 of 1 in the run · tool call 13 of 75 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How does Droppy arrange a primary and a secondary Button in MealDrop's cart panel footer, and which props mark each?

**Reason.** The agent was planning the scheduled-delivery feature, which starts by adding a secondary "Schedule delivery" button next to a primary "Order now" in the cart sidebar. It had read the cart menu code and fetched the Sidebar and Button docs. Among Button's listed stories, one was described as the action stack in Mealdrop's cart panel, so it probably loaded it to see the house pattern for primary and secondary actions there. The story showed a `large` button stacked over a `clear` one in a grid. The packet then shows more docs reading, and not the footer edit.

#### c031 · full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-full-opus-high/2026-08-19T16-27-17.534Z/706-new-ui-scheduled-flow/run-5` · story call 1 of 1 in the run · tool call 16 of 83 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `stated` · confidence `high` · outcome `unclear`

**Need.** How does the design system's cart-panel example stack its action buttons, to model 'Order now' and 'Schedule delivery' on it?

**Reason.** The agent had found no opening-hours data, then fetched the technical guidelines, Sidebar and Button docs. It remarked that the Button docs mention a 'Mealdrop Checkout Actions' story that is exactly its use case, and fetched it with supporting docs. The task places a primary 'Order now' and a secondary 'Schedule delivery' in the sidebar cart, so the story promised the endorsed layout for those two actions. It showed a large icon button above a clear button. The agent went on to choosing-components, accessibility, typography, token and Card docs; its later visible edit is a slot grid, not the footer.

> The Button docs mention a "Mealdrop Checkout Actions" story — exactly our use case.

#### c032 · full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-full-opus-high/2026-08-19T16-27-17.534Z/706-new-ui-scheduled-flow/run-6` · story call 1 of 1 in the run · tool call 19 of 108 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `stated` · confidence `high` · outcome `unclear`

**Need.** How does the design system arrange the cart panel's action buttons, and which props mark the primary versus the secondary action?

**Reason.** The agent was planning the scheduled-delivery feature, which starts by putting a secondary button next to the primary checkout button in the cart sidebar. After fetching Sidebar and Button docs it said outright that the design system has a story for MealDrop's cart action stack and that it would fetch it. The story showed a large filled button with a cart icon above a `clear` button in a grid with a 0.5rem gap. The agent then gathered spacing tokens and other docs. The only later Button edit shown is a schedule-picker styles file, so use of this pattern in the footer is not visible.

> The DS has a story specifically for Mealdrop's cart action stack — let me fetch it, plus the spacing and color tokens.

#### c033 · full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-full-opus-high/2026-08-19T16-27-17.534Z/706-new-ui-scheduled-flow/run-7` · story call 1 of 1 in the run · tool call 13 of 98 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `high` · outcome `unclear`

**Need.** How does Droppy's cart panel stack a primary checkout Button with a secondary action, and which props distinguish them?

**Reason.** Before any edit, the agent had read the cart sidebar code and fetched Sidebar and Button docs. The task adds a secondary button next to the renamed primary one in the cart footer. Button's prop notes already tied `clear` to secondary actions and `large` to primary calls to action, and this story was described as the cart panel's action stack, so the agent probably wanted the reference layout to copy. The story shows a large cart-icon button over a clear button in a grid with 0.5rem gap. The agent then read guideline, typography and token docs. The packet does not show the footer code.

#### c034 · full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-full-opus-high/2026-08-19T16-27-17.534Z/706-new-ui-scheduled-flow/run-8` · story call 1 of 1 in the run · tool call 13 of 85 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `high` · outcome `unclear`

**Need.** How does Droppy's cart panel combine a primary and a secondary Button, in props and layout, for the footer actions?

**Reason.** After reading the cart menu, checkout and restaurant data, the agent fetched the Sidebar and Button docs. The task requires a primary and a secondary action in the sidebar cart, but Button offers only boolean style flags. This story's one-line description named the cart panel's action stack, so it appears to have been loaded as the design system's own example of that footer. It showed a large icon button with a clear button beneath it. The agent continued to guideline and token docs and then inspected Button's compiled source; the footer edit is not visible in the packet.

#### c035 · full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-full-opus-high/2026-08-19T16-27-17.534Z/706-new-ui-scheduled-flow/run-9` · story call 1 of 1 in the run · tool call 17 of 124 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How does the design system's cart-panel example lay out and style its primary and secondary action Buttons?

**Reason.** The agent was gathering context for adding a Schedule delivery button beside a renamed Order now button in the sidebar cart, and had just read the Sidebar, Button and IconButton docs. The Button docs described this story as the action stack in Mealdrop's cart panel, which is exactly the area the task changes, so it probably wanted the reference pairing of a primary and a secondary button. The story showed a large icon button stacked above a clear one. The agent carried on through typography, spacing and guideline docs; the packet does not show the cart footer it eventually wrote.

#### c092 · purge-jsdoc · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-10-57.390Z/706-new-ui-scheduled-flow/run-10` · story call 1 of 1 in the run · tool call 14 of 71 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `high` · outcome `unclear`

**Need.** How does the design system's cart panel arrange its primary and secondary Buttons, and with which props?

**Reason.** The agent had read the cart menu, state, API and checkout code and then fetched the Sidebar and Button docs. The task adds a secondary 'Schedule delivery' button beside a primary 'Order now' in the sidebar cart, and nothing in Button's props names a secondary variant. The story's description matched that footer exactly, so it was probably loaded as the reference for pairing the two actions. It showed a large button above a clear one. The agent then read the choosing-components page, typography and Select docs, tokens and guidelines. Its first later file uses Button in a date picker; the footer edit is not shown.

#### c093 · purge-jsdoc · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-10-57.390Z/706-new-ui-scheduled-flow/run-2` · story call 1 of 1 in the run · tool call 19 of 78 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How does the design system stack the cart panel's primary and secondary buttons, and which Button props distinguish them?

**Reason.** The agent had spent its first calls looking for opening-hours data and reading the restaurant page, then fetched Sidebar and Button docs. The task begins with a primary Order now and a secondary Schedule delivery button in the cart sidebar, and Button exposes only clear, round and large, so it probably loaded the cart action-stack story to see how the design system expresses primary and secondary there. The story showed a large filled button with a cart icon above a `clear` one. The agent moved on to guidance and typography docs; the first later Button edit shown is a date picker, not the footer.

#### c094 · purge-jsdoc · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-10-57.390Z/706-new-ui-scheduled-flow/run-3` · story call 1 of 1 in the run · tool call 18 of 83 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `high` · outcome `unclear`

**Need.** How does Mealdrop's cart panel stack its action buttons, and which Button props set the primary action apart from the secondary?

**Reason.** The agent had explored the cart menu, header, success page and restaurant data, then fetched the Button docs first. The task adds a secondary 'Schedule delivery' button next to a primary 'Order now' in the sidebar cart. The docs listed this story with a description naming that panel's action stack, so the agent appears to have loaded it to see the endorsed arrangement before designing the footer. The story showed a large icon button over a clear button. The agent then read Sidebar, choosing-components, token and typography docs. No later edit mentioning Button appears in the packet.

#### c095 · purge-jsdoc · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-10-57.390Z/706-new-ui-scheduled-flow/run-4` · story call 1 of 1 in the run · tool call 15 of 86 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `high` · outcome `unclear`

**Need.** How does Mealdrop's cart panel arrange its action buttons, and which Button props separate the primary action from the secondary?

**Reason.** After surveying the cart, checkout and restaurant code, the agent said it would fetch docs for the components it needed and pulled Sidebar and Button. The task puts a primary 'Order now' and a secondary 'Schedule delivery' in the sidebar footer, and the Button docs listed this story with a description naming that very panel. The agent appears to have loaded it for a ready-made arrangement of the two actions. The story showed a large icon button over a clear one. The agent then read choosing-components, typography and token docs; its later visible edit is an option grid, not the footer.

> Now let me fetch the design system docs for the components I'll need.

#### c096 · purge-jsdoc · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-10-57.390Z/706-new-ui-scheduled-flow/run-5` · story call 1 of 1 in the run · tool call 15 of 80 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `high` · outcome `unclear`

**Need.** How does Mealdrop's cart panel arrange its action buttons, and which Button props make one action primary and the other secondary?

**Reason.** Having read the cart, order state, header and checkout form, the agent said it would fetch docs for the components it needed and pulled Sidebar and Button. The task renames 'Checkout' to 'Order now' as the primary action and adds a secondary 'Schedule delivery' beside it. The Button docs described this story as the cart panel's action stack, so the agent appears to have loaded it as the reference for that button group. It showed a large icon button over a clear one. The agent continued with typography, choosing-components, Separator and token docs; no later Button edit is shown.

> Now let me fetch the design system docs for the components I'll need.

#### c097 · purge-jsdoc · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-10-57.390Z/706-new-ui-scheduled-flow/run-6` · story call 1 of 1 in the run · tool call 13 of 87 · before first edit · story listed in the global listing only · kind `app-example` · evidence `inferred` · confidence `high` · outcome `unclear`

**Need.** How does Droppy's cart-panel example pair a primary and a secondary Button: which props distinguish them and how are they stacked?

**Reason.** The agent was planning the scheduled-delivery feature, which starts by renaming the sidebar's Checkout button to a primary 'Order now' and adding a secondary 'Schedule delivery' beside it. It had read ShoppingCartMenu and fetched the Button and Sidebar docs. Button has no variant prop in its table, so the way to express primary versus secondary was not obvious. The story described as the cart panel's action stack appears to have been loaded to see that pairing. It showed a large Button with a cart icon above a clear Button in a grid. The agent next read spacing tokens and typography docs.

#### c098 · purge-jsdoc · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-10-57.390Z/706-new-ui-scheduled-flow/run-7` · story call 1 of 2 in the run · tool call 18 of 111 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How does the design system stack the cart panel's primary and secondary buttons, and which Button props distinguish them?

**Reason.** After exploring restaurant data and the cart code, the agent fetched Sidebar and Button docs and loaded this story at once, followed by the Sidebar cart-panel story. The task's first requirement is a primary and a secondary button side by side in the cart sidebar, and Button's props offer only clear, round and large, so the agent probably wanted to see which combination the design system uses for each role. The story showed a large filled button with a cart icon above a `clear` button. The later Button edit shown is a schedule option grid, so reuse in the footer is not visible.

#### c099 · purge-jsdoc · 706 · Sidebar / "Mealdrop Cart Panel"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-10-57.390Z/706-new-ui-scheduled-flow/run-7` · story call 2 of 2 in the run · tool call 19 of 111 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system compose the cart Sidebar's children and pinned footer, where the scheduling steps must appear?

**Reason.** Loaded straight after the Button cart-actions story, as the second of two MealDrop-specific stories. The feature requires a date picker and time grid shown within the cart sidebar plus changes to its footer buttons, so the agent probably wanted the reference composition of the panel: what goes in children and what goes in the footer. The story returned only `<ShoppingCartMenu container={args.container} />`, a wrapper named like the app component the agent had already located. It gave nothing new, and the agent continued with choosing-components, typography and separator docs.

#### c100 · purge-jsdoc · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-10-57.390Z/706-new-ui-scheduled-flow/run-8` · story call 1 of 1 in the run · tool call 102 of 108 · after first edit · story listed without source in the component docs · kind `app-example` · evidence `stated` · confidence `high` · outcome `confirmed`

**Need.** Does Droppy's cart panel place the primary and secondary buttons side by side or stacked, and with which variants?

**Reason.** This came at tool call 102 of 108, after the scheduling feature was built and tests, lint and types passed. The agent appears to have been doing a final check of its cart footer against the design system: the brief asked for "Schedule delivery" next to "Order now", primary and secondary. It loaded the Button story for Mealdrop's cart panel actions, which stacks a `large` primary over a `clear` secondary with a 0.5rem gap. No cart-menu edit follows; its closing summary cites this story as the reason the buttons are stacked rather than side by side.

> The DS's own `Button` story for this exact panel ("Mealdrop Checkout Actions") stacks the primary over a `clear` secondary with a 0.5rem gap, so I followed that rather than putting them shoulder to shoulder

#### c101 · purge-jsdoc · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-10-57.390Z/706-new-ui-scheduled-flow/run-9` · story call 1 of 1 in the run · tool call 15 of 95 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `high` · outcome `unclear`

**Need.** How does Mealdrop's cart panel stack its action buttons, and which Button props mark the primary versus the secondary action?

**Reason.** The agent had read the header, cart state, restaurant data and checkout page, then fetched the Button docs. The task adds a secondary 'Schedule delivery' button beside a primary 'Order now' in the sidebar cart, and Button exposes only clear, round and large flags. The story's one-line description matched that footer directly, so the agent appears to have loaded it to copy the design system's own arrangement. It showed a large icon button over a clear one in a grid. The agent then fetched Sidebar, choosing-components and typography docs. Its later visible Button comment concerns grid cells, not the footer.

#### c157 · stories-full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-1` · story call 1 of 2 in the run · tool call 15 of 77 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `high` · outcome `unclear`

**Need.** How does the design system's cart example arrange its action buttons, and which Button props mark the main action versus the lesser one?

**Reason.** After reading the checkout page, header, cart state and restaurant data, the agent announced it would fetch docs for the components it needed. With Sidebar and Button docs in hand, it loaded this story and then 'Variants'. The task asks for 'Order now' as primary with 'Schedule delivery' as secondary in the sidebar cart, so the agent appears to have wanted the design system's own example of that button group. The story showed a large icon button above a clear one. The agent continued with typography, Card and ScrollArea docs; no later Button edit is shown.

> Now let me fetch the design system docs for the components I'll need.

#### c160 · stories-full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-10` · story call 2 of 3 in the run · tool call 15 of 71 · before first edit · story listed in the global listing only · kind `app-example` · evidence `inferred` · confidence `high` · outcome `unclear`

**Need.** How does the design system's cart example stack its two actions, and which Button props give the checkout action priority?

**Reason.** Loaded directly after 'Variants', before any edit. The agent was about to rename the cart's 'Checkout' button to 'Order now' and add 'Schedule delivery' beside it as a secondary action. With only boolean flags on Button, it probably wanted an in-context example of two cart actions with different weight. The story showed a large icon button above a clear button inside a card. The agent moved on to typography, Separator and IconButton docs. Its later visible edit concerns date option labels, so the packet does not show whether the footer copied this arrangement.

#### c163 · stories-full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-2` · story call 2 of 2 in the run · tool call 20 of 82 · before first edit · story listed in the global listing only · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How does Mealdrop's cart panel arrange and style its checkout button alongside a secondary action?

**Reason.** Loaded in the same burst as Variants, before any edit. The task changes the pair of action buttons in the cart sidebar, and this story's name suggests the design system's own rendering of those checkout actions, so the agent probably wanted a reference for which props and layout to use for a primary button with a secondary one next to it. The story shows a large cart-icon button above a clear button in a grid with 0.5rem gap. The agent then fetched docs for the components the story imports and for Sidebar. The packet does not show the footer it eventually wrote.

#### c165 · stories-full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-3` · story call 2 of 2 in the run · tool call 13 of 99 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `unclear`

**Need.** How does the design system's MealDrop example pair a primary and a secondary button in the cart's action area?

**Reason.** Loaded immediately after Variants in the same burst. Having seen the individual button styles, the agent probably wanted them in context: how the design system combines a main and a lesser action in MealDrop's cart, since the task turns the sidebar's single Checkout button into Order now plus Schedule delivery. The story showed a large filled `Go to checkout` button with a cart icon above a `clear` `Continue shopping` button, stacked in a grid. The agent went on to typography, icon button, separator and card docs. Its footer edit is not shown, so adoption cannot be verified.

> Now let me fetch the design system docs for the components I'll need.

#### c167 · stories-full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-4` · story call 2 of 2 in the run · tool call 20 of 85 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `high` · outcome `unclear`

**Need.** How does the design system's own cart example stack its checkout buttons, and which props give the main action more weight than the other?

**Reason.** Loaded straight after 'Variants' in the same burst, before any edit. The agent was preparing to rename 'Checkout' to 'Order now' and add a secondary 'Schedule delivery' button in the sidebar cart. Having seen that Button styles come only from flags, it appears to have wanted a real composition showing two cart actions with different emphasis. The story showed a large icon button above a clear button in a grid with a small gap. The agent then fetched typography, Card, Badge and Separator docs and read the order summary; the packet shows no later Button edit.

#### c169 · stories-full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-5` · story call 2 of 2 in the run · tool call 18 of 87 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How does Droppy's checkout example combine its primary and secondary Buttons, in props and layout?

**Reason.** Loaded immediately after Variants, as the second of two Button stories. The agent needed to place a secondary 'Schedule delivery' next to the primary 'Order now' in the cart sidebar, and Variants had only shown the individual looks. This story's name pointed at Mealdrop's own checkout actions, so it probably looked like the pattern to imitate. It showed a cart card whose footer stacks a large icon button over a clear one in a grid. The agent went on to typography, Card, Separator and IconButton docs, most of which the story composes. The footer edit is not visible.

#### c170 · stories-full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-6` · story call 1 of 2 in the run · tool call 17 of 97 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `high` · outcome `unclear`

**Need.** How does the design system lay out the cart panel's action buttons, and which Button props distinguish the primary action from the secondary one?

**Reason.** The agent had finished reading the cart, header and restaurant code and said it would fetch docs for the components it needed. After the Sidebar and Button docs, it loaded this story and 'Variants' back to back. The task asks for two cart buttons with primary and secondary emphasis, and Button has no variant prop, so the agent probably wanted the design system's own example of stacked cart actions. The story showed a large button with an icon above a clear one. The agent went on to more docs; the packet does not show the cart footer it finally wrote.

> Now let me fetch the design system docs for the components I'll need.

#### c173 · stories-full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-7` · story call 2 of 2 in the run · tool call 17 of 79 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How does the design system's Mealdrop cart example arrange and style its checkout Buttons, primary versus secondary?

**Reason.** Loaded directly after Variants, in the same burst, while the agent prepared to add a secondary Schedule delivery button beside a primary Order now button in the cart sidebar. Variants had shown isolated styles; this story's name pointed at the same checkout button group in Mealdrop, so it probably wanted the design system's own composition of those actions. It showed a large button with a cart icon stacked above a clear button inside a card. The agent went on to Card, Body, IconButton and Heading docs; the cart footer it eventually wrote is not visible in the packet.

#### c175 · stories-full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-8` · story call 2 of 2 in the run · tool call 18 of 95 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How does the design system's cart panel arrange its primary and secondary action Buttons, and with which props?

**Reason.** Loaded directly after Variants, as the second of two Button stories. The feature adds a secondary "Schedule delivery" button next to the cart's checkout button, renamed "Order now" and kept primary. A story named for checkout actions probably looked like the reference for that button stack. The source showed a Card with a large icon Button for "Go to checkout" above a clear "Continue shopping" Button, laid out in a grid with a gap. The agent then fetched docs for Card, Heading and Separator, components this story composes, plus IconButton and design tokens. The packet does not show the resulting footer code.

#### c177 · stories-full · 706 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-9` · story call 2 of 2 in the run · tool call 15 of 83 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How does Droppy's checkout example pair a primary and a secondary Button, in props and layout?

**Reason.** Loaded right after Variants as the second of a pair. The agent was preparing to put a secondary 'Schedule delivery' button beside the primary 'Order now' in the cart sidebar and had just seen the individual button looks. A story named after Mealdrop's checkout actions probably looked like the design system's worked example of that footer. It showed a large icon button stacked above a clear one inside a padded Card. The agent then searched for opening-hours data, read the Button typings and fetched the Card docs. Its later scheduling component imports Button, but the footer change is not shown.

### example-form-wiring — Check an in-app example for native form wiring (41 calls)

The agent has a hypothesis about native form mechanics that the component docs do not cover (a real form element, which control submits, a submit type, name/type/autocomplete on fields) and loads the design system's in-app example to see whether real usage embodies it.

#### c042 · full · 703 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-32-56.740Z/703-fix-bug-flow/run-2` · story call 2 of 2 in the run · tool call 10 of 53 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Does the design system's checkout action example pass `type` to Button or otherwise show how a form gets submitted?

**Reason.** Loaded straight after the Button test story, in the same burst. The agent was fixing Enter-to-submit on checkout and had just noted that Button documents no `type` prop; the test story's source had shown nothing but a bare Button. It probably turned to the one realistic checkout example to see whether Buttons there are given a type or sit inside a form. The story is the cart panel's action stack, with visual props only. The agent then declared the missing type prop confirmed, looked at the test setup, searched for existing forms, and read the package bundle.

> Important: `Button` has no documented `type` prop, and there's a story named "Test Defaults To Type Button".

#### c045 · full · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-32-56.740Z/703-fix-bug-flow/run-4` · story call 2 of 3 in the run · tool call 9 of 50 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Does Droppy's checkout form example wrap its Inputs in a <form> with a submit button or handler to copy?

**Reason.** Immediately after the type-default story, and in the same burst, the agent loaded the design system's checkout form example. It had just established that the app's fields are not inside a form and that Button exposes no `type`, so it was probably looking for the intended way to build and submit this form. The story showed Inputs grouped in sections inside a form element, but with no button and no submit handler. The agent then read the package source and said it would check whether Droppy exposes a form or submit pattern, and finally wrapped the fields in a form with its own Enter handler.

> The fields sit in a plain `<div>`, so there's no form to submit. Let me check the Button and Input APIs before wiring it up.

#### c046 · full · 703 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-32-56.740Z/703-fix-bug-flow/run-4` · story call 3 of 3 in the run · tool call 17 of 50 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Does Droppy's checkout actions example show a Button wired to submit a form, or any form/submit pattern?

**Reason.** The agent had confirmed in the compiled source that Button sets its type to button and said it wanted to see whether Droppy exposes a form or submit pattern before deciding how to wire Enter. After listing the package exports it loaded this checkout-themed Button story, probably as the last place such a pattern might be demonstrated. The story showed only presentational buttons in a cart card, with no form or handlers. The agent then checked app styles, hooks and test setup and implemented its own submit-on-Enter keydown helper on a form wrapper. It was the third story loaded in the run.

> Let me check whether Droppy exposes a form/submit pattern before I decide how to wire Enter.

#### c048 · full · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-32-56.740Z/703-fix-bug-flow/run-5` · story call 2 of 2 in the run · tool call 9 of 56 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Does Droppy's checkout form example show how the form is submitted: a <form> wrapper, a submit button or an onSubmit handler?

**Reason.** This load came straight after Button's 'Test Defaults To Type Button', as part of the same check of how the design system supports submit behaviour. Having learned nothing explicit about type from the Button snippet, the agent probably wanted to see whether the reference checkout form used a form element and how it triggered submission. The story showed a <form> with two headed sections of Inputs and error messages, but no button or submit handler. The agent's next remark concerned only Button's default type; it verified that in the package source and later added a SubmitOnEnter helper to ContactDetails.

> Now let me check the design system docs for `Button` and `Input` to see how submit behaviour is supported.

#### c051 · full · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-44-48.066Z/703-fix-bug-flow/run-2` · story call 2 of 2 in the run · tool call 9 of 36 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `confirmed`

**Need.** Does Droppy's reference checkout form put Inputs in a real `<form>`, and does it include a submit button or handler?

**Reason.** Loaded immediately after Button's type test, as part of the same check of the Button and Input APIs. The agent had just established that the checkout steps contain no `<form>`, so it probably wanted to see how the design system's own checkout form is built and whether it carries any submit wiring. The story shows a native `<form>` with two headed sections of Inputs, with no button and no handler. The agent said nothing about it directly; it went on to inspect Button in the package dist and tried to probe how browsers submit multi-field forms with and without a submit button.

> Let me check the design system's Button and Input APIs.

#### c053 · full · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-44-48.066Z/703-fix-bug-flow/run-3` · story call 2 of 2 in the run · tool call 10 of 35 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `confirmed`

**Need.** Does the design system's reference checkout form put Inputs inside a native form element, and what submits it?

**Reason.** Loaded immediately after the Button test story, in the same burst, while the agent was checking the Button and Input APIs for the Enter-to-submit fix. The listed description called it Mealdrop's checkout form, so it probably looked like the design system's reference for the very form being repaired: whether Inputs sit in a form element and what submits it. The story showed Inputs in two sections inside a native form, with no button or submit handler. The agent then looked for existing form patterns in the app and wrapped both steps in real forms with a hidden submit button.

> Now let me check the Button and Input component APIs from the design system.

#### c055 · full · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-44-48.066Z/703-fix-bug-flow/run-4` · story call 2 of 2 in the run · tool call 9 of 41 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How does the design system's reference checkout form group its Inputs: in a native `<form>`, with a submit control or handler?

**Reason.** Loaded straight after the Button type-default story, in the same burst. The agent was working out why Enter does not submit the checkout steps and had both component docs open. The Input listing offered a story described as Mealdrop's checkout form, which probably looked like a reference for how the fields and their container should be built. The source showed Inputs in a native `<form>` with two headed sections but no submit button or onSubmit. The agent then grepped the app for onSubmit, form and Enter handlers and read Button's types and implementation; the packet does not show the eventual edit.

#### c113 · purge-jsdoc · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-1` · story call 2 of 2 in the run · tool call 9 of 43 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `confirmed`

**Need.** How does Droppy's own checkout form wire its Inputs: inside a real `<form>`, and with what submit control or handler?

**Reason.** Loaded in the same burst as Button's type test, right after the agent said it would check the Button and Input API before changing the checkout steps. Having found the fields live in a `<div className="form">`, it probably wanted the design system's reference checkout form, to see whether Inputs sit in a native form and how submission is wired. The story shows a plain `<form>` with two headed sections of Inputs and no button or submit handler. The agent's next remark concerns only Button; it then wrapped both steps in forms with its own hidden submit button.

> Let me check the Button and Input API before changing anything.

#### c116 · purge-jsdoc · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-2` · story call 2 of 2 in the run · tool call 9 of 45 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Does Droppy's reference checkout form show a documented way to submit: form element, submit button or handler?

**Reason.** The agent had said it would check the Button and Input docs before changing anything, and loaded this story directly after Button's type-default test, so the two form one burst. With Button apparently unable to submit, it probably looked to the reference checkout form for how submission is meant to work. The story showed a <form> with two headed sections of Inputs, two of them in error, and no submit control. The agent then inspected Button in the package and said it would check the technical and accessibility guidelines for a documented form-submission pattern, which suggests the story had not supplied one.

> Now let me check the design system docs for Button and Input before changing anything.

#### c118 · purge-jsdoc · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-3` · story call 2 of 2 in the run · tool call 9 of 69 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `confirmed`

**Need.** Does the design system's reference checkout form wrap its Inputs in a real `<form>`, and how is it submitted?

**Reason.** Loaded right after the Button type story, in the same burst. The agent had decided the fix needed a real form element and was checking the Button and Input APIs before editing. The Input listing offered a checkout-form story, which probably looked like the canonical way to compose these fields. The source showed Inputs inside a native `<form>` with two headed sections, but no submit button or onSubmit handler. That agrees with the agent's diagnosis without settling how submission should work, and the agent went on to read Button's implementation in the package and the technical guidelines.

> Let me check the design system's Button and Input APIs.

#### c120 · purge-jsdoc · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-4` · story call 2 of 2 in the run · tool call 9 of 50 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `confirmed`

**Need.** Does the design system's reference checkout form place Inputs in a native form element, and with what submit control?

**Reason.** Loaded right after the Button test story, in the same burst. The agent had already decided the checkout fields needed a real form and was checking the Button and Input APIs first. The listed description called this Mealdrop's checkout form, so it probably served as the design system's reference for how these Inputs are assembled and whether a form element is used. It showed Inputs in two sections inside a native form with no submit control. The agent then checked form class styles and wrapped each step in a real form, adding its own hidden submit button.

> Let me check the design system's Button and Input APIs before changing anything.

#### c123 · purge-jsdoc · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-6` · story call 2 of 2 in the run · tool call 9 of 31 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `confirmed`

**Need.** Does the design system's own checkout example wrap its Inputs in a real `<form>`, and how is it submitted?

**Reason.** Loaded immediately after the Button type-button test story, in the same burst. The agent had concluded that Enter fails because the checkout steps have no `<form>` element and was checking the Button and Input APIs before changing anything. The Input docs listed a story described as Mealdrop's checkout form, and it appears to have loaded it to see how the design system itself builds that form, especially the wrapper and any submit control. The story wraps two headed sections of Inputs in a real `<form>` with no button. The agent afterwards noted that the design system's own checkout example uses a real form.

> The DS's own checkout example wraps fields in a real `<form>`.

#### c207 · stories-full · 703 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-1` · story call 2 of 2 in the run · tool call 9 of 45 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `stated` · confidence `medium` · outcome `answered_negative`

**Need.** Do the design system's checkout action Buttons show any form or submit wiring that the checkout steps should copy?

**Reason.** Second of a pair of loads, right after the type-default test story. The agent had diagnosed the missing form element and wanted to know how Button fits into a submitting form before editing. It had said it would check the checkout-specific stories, and this was the Button one. The source showed a cart panel with a large "Go to checkout" Button and a clear "Continue shopping" Button inside a Card, without any form, handler or type attribute. With no pattern to copy, the agent went to the installed package, read ButtonProps and the compiled Button, and found the hard-coded type.

> Let me check those and the checkout-specific stories.

#### c209 · stories-full · 703 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-10` · story call 2 of 2 in the run · tool call 9 of 49 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Does Droppy's checkout actions example show how a checkout Button should trigger submission, such as a form or submit pattern?

**Reason.** Second of two stories loaded together. The agent had said it would check the type-default story and the checkout-specific stories, having found that the checkout inputs are not in a form and Button documents no `type`. It was probably looking for how the design system's own checkout example wires its action button, in case there was a submit pattern to follow. The story showed a cart card with a large 'Go to checkout' button and a clear secondary one, with no form or handlers. The agent then went to the package typings and compiled source to work out Button's type handling.

> Let me check that and the checkout-specific stories.

#### c211 · stories-full · 703 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-2` · story call 2 of 3 in the run · tool call 9 of 53 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Does Mealdrop's checkout-actions example give its Buttons a `type` or put them in a form, showing how checkout actions should submit?

**Reason.** Loaded alongside the type-default test, after the agent said it would check before assuming a form wrapper is enough. The narration names only the test story, so the reason for this one is inferred: it is the design system's realistic checkout button example, and the agent probably wanted to see whether such buttons are ever given a `type` or placed in a form. The story shows a cart card with a large icon button and a clear button, with no type and no form. The agent then summarised that Button exposes no `type` prop and went to the package dist to verify.

> Let me check those before assuming a `<form>` wrapper is enough.

#### c212 · stories-full · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-2` · story call 3 of 3 in the run · tool call 11 of 53 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `stated` · confidence `high` · outcome `confirmed`

**Need.** Does Droppy's checkout form example wrap Inputs in a `<form>`, and how does it submit without a submit-type Button?

**Reason.** Third story of the run, announced beforehand: having concluded from the Button stories that Button always renders `type="button"`, the agent said it would verify the built component and check the Input form story. It wanted to see how the design system's own checkout form is put together given that constraint. The story shows a native `<form>` with two headed sections of Inputs and no submit button or handler, so it offered a form wrapper but no submission pattern. The agent returned to the Button build to check prop-spread order, then wrote a StepForm: a real form with a hidden submit button.

> Let me verify the built component and check the Input form story.

#### c214 · stories-full · 703 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-3` · story call 2 of 4 in the run · tool call 10 of 51 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `answered_negative`

**Need.** Does the Mealdrop checkout-actions example show a Button that submits (a type prop or form wrapper) for the checkout call to action?

**Reason.** Immediately after loading 'Test Defaults To Type Button', the agent loaded this second Button story, so the two belong to one burst. The earlier snippet had shown nothing about type, and the agent probably hoped the checkout example would show how a Droppy Button is wired to complete a checkout step, for instance inside a form or with a submit type. The story turned out to be the cart panel's action stack: a large 'Go to checkout' Button and a clear one, with no form and no type. The agent then went into the package types and bundle for Button.

#### c215 · stories-full · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-3` · story call 3 of 4 in the run · tool call 16 of 51 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `confirmed`

**Need.** Does Droppy's checkout form example wrap its Inputs in a <form>, and does it show a submit button or onSubmit handler?

**Reason.** After digging through the package for Button's type handling, the agent returned to Storybook and loaded this story, then Button's 'Anatomy' straight after. It was about to restructure the checkout steps so Enter submits, and the story name promised the reference version of that form; it probably wanted to see whether the design system wraps the fields in a form element and how submission is expressed. The story showed a real <form> with two headed sections of Inputs, but no button and no handler. The agent then announced the fix: wrapping each step in a real form with a submit handler.

#### c218 · stories-full · 703 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-4` · story call 2 of 3 in the run · tool call 9 of 44 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** How does the design system wire Buttons in Mealdrop's checkout: does any submit a form or receive a `type`?

**Reason.** Fetched together with the Button test story after the agent said two stories looked directly relevant. It was fixing Enter-to-submit on checkout and had seen no `type` in Button's props, so a story named for checkout actions probably looked like the place to see how the design system wires checkout buttons, and whether any submits a form. The story was the cart panel's action stack with visual props only. The agent's following remark mentions only the type default, and it went to the package bundle to confirm what Button renders.

> Two stories look directly relevant.

#### c219 · stories-full · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-4` · story call 3 of 3 in the run · tool call 13 of 44 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** What is the design system's intended pattern for submitting the checkout form, given Button hardcodes type="button"?

**Reason.** After two Button stories, the agent inspected the package bundle and found Button hardcodes type button. That ruled out simply making the Droppy Button a submit button, so it said it would check Input's checkout-form story for the intended pattern and look for existing forms in the codebase. The story showed Inputs inside a native form but no submit control or handler, so the intended submission pattern was not there. The agent searched the app for forms and Enter handling, looked at how the test library triggers implicit submission, and later added a hidden native submit button.

> Let me check the Input's checkout-form story for the intended pattern, and look for existing form patterns in the codebase.

#### c221 · stories-full · 703 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-5` · story call 2 of 2 in the run · tool call 9 of 35 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Does the design system's checkout example show a Button submitting a form, for instance with type="submit"?

**Reason.** Loaded immediately after Test Defaults To Type Button, as the second of the relevant stories the agent said it would check before assuming anything. With a real form planned for each checkout step, it probably hoped the design system's own checkout example would show how a Button is made to submit. The story was the cart panel instead: a close icon button, a large `Go to checkout` button and a clear `Continue shopping` button, with no form and no type. The agent then said it would confirm how Button actually renders and read the package's code and types.

> Let me check those relevant stories before assuming anything.

#### c223 · stories-full · 703 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-6` · story call 2 of 2 in the run · tool call 9 of 51 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `answered_negative`

**Need.** How are Buttons used for checkout actions in the design system's own example: inside a form, with any submit behaviour?

**Reason.** Loaded right after the type-default test story, as the second of two in a burst. The agent was deciding how to make Enter submit the checkout steps given that Button documents no `type` prop. A story named for checkout actions probably promised a realistic example of how the primary checkout button is wired. The source showed a cart panel Card with a large "Go to checkout" Button and a clear "Continue shopping" Button, with no form or type attribute. The agent then read the compiled Button, saw the hard-coded type, and later wrote a submitOnEnter key handler instead of a submit button.

#### c225 · stories-full · 703 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-7` · story call 2 of 3 in the run · tool call 9 of 45 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Does Mealdrop's checkout-actions example show Buttons given a `type` or used inside a form to submit?

**Reason.** Loaded in one burst with the type-default test and the Input checkout form, after the agent said it would check those and the Mealdrop-specific stories. The purpose for this story is not spelled out; it probably wanted to see how the design system's realistic checkout buttons are wired, in particular whether any carries a `type` or sits in a form. The story shows a cart card with a large icon button and a clear button, neither with a type, and no form. The agent's summary afterwards says Button exposes no `type` prop, and it went to the package to verify before using a native submit button.

> Let me check those and the Mealdrop-specific stories.

#### c226 · stories-full · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-7` · story call 3 of 3 in the run · tool call 10 of 45 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `confirmed`

**Need.** Does Droppy's checkout form example place Inputs in a real `<form>` with native props, and how is that form submitted?

**Reason.** Third story in a single burst, after the agent said it would check the type test and the Mealdrop-specific stories. With the bug traced to the missing form element, it probably wanted the design system's own checkout form to confirm Inputs can live in a native form and to see any submit wiring. The story shows a `<form>` with two headed sections of Inputs taking defaultValue, and no submit control. The agent's takeaway was that Input passes native props through inside a real form, while Button remains the obstacle. It then wrapped the steps in forms with a native hidden submit button.

> Let me check those and the Mealdrop-specific stories.

#### c228 · stories-full · 703 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-8` · story call 2 of 2 in the run · tool call 9 of 38 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `stated` · confidence `medium` · outcome `answered_negative`

**Need.** How do the design system's checkout action Buttons get wired: do they sit in a form or use a submit type?

**Reason.** Loaded immediately after the type-default test story, in the same burst. The agent was preparing to turn the checkout steps into real forms and wanted to know how Button behaves as a submit control. It had said it would check the checkout-specific stories, and this was the Button one. The source showed a cart panel in a Card with a large "Go to checkout" Button and a clear "Continue shopping" Button, with no form, onSubmit or type attribute. The agent then said it would verify against the installed design system source whether `type` is even forwarded, and read the compiled Button and its types.

> Let me check those plus the checkout-specific stories.

#### c230 · stories-full · 703 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-9` · story call 2 of 3 in the run · tool call 10 of 45 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Does the design system's checkout example show Buttons submitting a form, for instance through a `type` prop or a form wrapper?

**Reason.** Loaded in the same burst as the Button test story and Input's checkout-form story, right after the agent announced it would check the directly relevant stories. It was fixing Enter-to-submit on checkout and had seen that Button documents no `type` prop, so it probably wanted a realistic checkout example to see whether Buttons are ever given a type or placed in a form. The story turned out to be the cart panel's action stack: plain Buttons with visual props only. Nothing in it addressed submission, and the agent moved on to the package's typings and bundle.

> Let me check the directly relevant stories.

#### c231 · stories-full · 703 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-9` · story call 3 of 3 in the run · tool call 11 of 45 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `confirmed`

**Need.** Does the design system's own checkout-form example wrap its Inputs in a native form element, and how does it submit?

**Reason.** Third story in a burst with the two Button stories. The agent had already diagnosed that the checkout fields sat in a div with class form, not a real form, and said it would check the directly relevant stories before editing. A story named after the checkout form appears to have promised the design system's own way of assembling these Inputs, including whether a form element and submit control are used. It showed Inputs grouped in sections inside a native form, with no button or handler. That matched the planned fix; the agent's next remark concerns only Button's type.

> Let me check the directly relevant stories.

#### c129 · purge-jsdoc · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-55-56.178Z/704-fix-a11y-flow/run-3` · story call 2 of 2 in the run · tool call 13 of 35 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `adopted`

**Need.** How does Droppy's reference checkout form structure its Inputs: form element, section headings, and any name, type or autocomplete attributes?

**Reason.** The complaint was that users cannot tell checkout has moved on to delivery details and that browsers never offer saved details. Input's documented props were just label and error, so the agent probably wanted the reference checkout form to see how fields are grouped, headed and attributed. It was loaded together with Button's type test. The story shows a native `<form>` with two sections, each under a `<Heading level={3} size={4}>`, and Inputs with label, defaultValue and error, but no autocomplete or name. The agent next fetched Heading docs, then rewrote both steps with form submit handlers and a StepIndicator that imports Heading.

> Now let me fetch the design system docs for the relevant components.

#### c132 · purge-jsdoc · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-55-56.178Z/704-fix-a11y-flow/run-5` · story call 2 of 2 in the run · tool call 12 of 50 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `unclear`

**Need.** How does Droppy's own checkout form structure its Inputs: form element, section headings, error messages, any autofill attributes?

**Reason.** Second of two Mealdrop stories loaded back to back after the agent said it would check the docs for the relevant components. The accessibility complaints concern the checkout form's step change and autofill, and Input's list offered a story described as Mealdrop's checkout form with two fields in error. The agent appears to have wanted the design system's reference for form structure and error display. It showed a real `<form>`, headed sections and Inputs with `label`, `defaultValue` and `error`, and no autofill attributes. The agent next grepped the app for `.form` styles; its later edits concern focusing the first invalid field.

> Now let me check the design system docs for the relevant components.

#### c134 · purge-jsdoc · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-55-56.178Z/704-fix-a11y-flow/run-6` · story call 2 of 2 in the run · tool call 15 of 38 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `adopted` · coders split: example-form-wiring, example-form-wiring, example-model

**Need.** How does Droppy's checkout form example structure the fields: form element, section headings, and which props each Input receives?

**Reason.** Loaded immediately after ProgressBar's 'Mealdrop Checkout Steps', this was the second of two reference checkout examples the agent pulled before changing anything. The complaints concern autofill and noticing the step change, and the Input props table showed only label and error, so the agent probably wanted to see how a correct checkout form is marked up. The story showed a real <form> with two sections, each under a level-3 Heading, and Inputs with label, defaultValue and error only. The agent then checked whether the app's .form class was styled and later rewrote ContactDetails with a form submit handler.

#### c232 · stories-full · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-1` · story call 1 of 5 in the run · tool call 8 of 56 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** How does the design system's reference checkout form set up its Inputs: labels, grouping, and any autocomplete or other native attributes?

**Reason.** The agent had read the checkout flow and said it would check docs for the components involved, fetching Input and ProgressBar. It then loaded this story together with the ProgressBar checkout-steps story, the first of five story loads in the run. Autofill and step clarity were the reported problems, so the agent probably wanted to see how the design system's own checkout form configures its fields and sections. The story showed a form with two headed sections and Inputs carrying only label, defaultValue and error. The agent then opened the package and checked InputProps and the compiled Input.

> Now let me check the design system docs for the components involved.

#### c237 · stories-full · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-10` · story call 1 of 8 in the run · tool call 8 of 57 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** How does the design system's reference checkout form configure its Inputs: are autoComplete, name or type passed?

**Reason.** The agent was auditing the checkout flow for accessibility complaints, including browsers never offering saved email or address. It had just fetched the Input and ProgressBar docs, and Input's props table listed only label and error. A story named after the checkout form probably looked like the reference for how these fields should be configured, including any autofill-related attributes. It was loaded together with ProgressBar's Mealdrop Checkout Steps. The example passed only label, defaultValue and error, so the agent went to the package's typings and bundle, and later recorded that Input defaults autoComplete to off.

> Now let me fetch the design system docs for the relevant components.

#### c245 · stories-full · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-2` · story call 1 of 2 in the run · tool call 8 of 43 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** How does the design system's own checkout form use Input: does it pass autocomplete, type or name beyond label and error?

**Reason.** Having read the checkout code and seen both complaints in it, the agent said it would check the design-system APIs before changing anything. Input's docs listed just label and error, which does not say whether autofill attributes can be passed. It loaded the checkout-form story, then the ProgressBar steps story, probably to see what a reference checkout passes to Input. The story showed a form with headed sections but only label, defaultValue and error on each Input. The agent then read the Input, Button and ProgressBar declarations in the package and later rewrote ContactDetails around a form submit.

> Let me check the design system APIs before changing anything.

#### c247 · stories-full · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-3` · story call 1 of 4 in the run · tool call 9 of 56 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Does the design system's reference checkout form pass native attributes like autoComplete or type to Input so browsers can autofill?

**Reason.** The agent was fixing checkout accessibility and missing autofill. It had read the checkout components and fetched the Input and ProgressBar docs; the Input props table showed only `label` and `error`. It loaded this story first in a burst of three (with the checkout-steps and Input Anatomy stories), apparently to see how a reference checkout form configures its fields. The story showed a `<form>` with two headed sections and Inputs using only label, defaultValue and error, with no autoComplete. The agent then read the package's type declarations and compiled Input code, where it found autoComplete hard-coded to off.

> Let me check the design system docs and existing tests.

#### c251 · stories-full · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-4` · story call 1 of 6 in the run · tool call 9 of 63 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** How does the design system's own checkout form use Input: does it pass autocomplete, name or type, and how are the two steps grouped?

**Reason.** After reading the checkout components, the agent said it would fetch docs for the components involved and pulled Input and ProgressBar. Input's props table showed only label and error, which says nothing about autofill attributes. This story promised the design system's own version of the checkout form, so it was loaded first in a burst of four stories. It showed a real form with a headed section per step, but the Inputs carried only label, defaultValue and error. After the burst the agent opened the package's type declarations and bundled Input code, apparently to find out what else Input accepts.

> Now let me fetch the design system docs for the components involved.

#### c256 · stories-full · 704 · Button / "Mealdrop Checkout Actions"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-4` · story call 6 of 6 in the run · tool call 38 of 63 · after first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** How does the design system's checkout example use Button for its main action: inside a form, with a submit type?

**Reason.** Loaded right after Test Defaults To Type Button, as the second half of the agent's check on the Button API. Having confirmed that checkout has no form element, it probably wanted to see how the design system's own checkout example wires its action buttons, hoping for a form or a submit button. The story turned out to be the cart panel: a close icon button, a large `Go to checkout` button and a clear `Continue shopping` button, none inside a form. The agent then read Button's implementation and type declarations in the package instead.

> Let me check error-state wiring and the Button API.

#### c257 · stories-full · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-5` · story call 1 of 5 in the run · tool call 8 of 62 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** How does Droppy's reference checkout form mark up its fields: form element, grouping, and any autocomplete or name attributes on Input?

**Reason.** The agent had read the checkout page and form components and said it would check the docs for the relevant components. Input's page listed only `label` and `error` as props, with story names and no descriptions. It loaded "Mealdrop Checkout Form" and, in the same burst, ProgressBar's "Mealdrop Checkout Steps", apparently looking for the design system's reference version of the flow it had to fix. The story showed a `<form>` with two headed sections and Inputs using `label`, `defaultValue` and `error`. The agent then went to the package's index.d.ts for Input's real prop types; no later edit is shown.

> Now let me check the design system docs for the relevant components.

#### c262 · stories-full · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-6` · story call 1 of 4 in the run · tool call 8 of 62 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Does Droppy's checkout form example pass native attributes such as name, type or autoComplete to Input, and how does it group the two steps?

**Reason.** Starting the accessibility task, the agent had read the checkout components and fetched Input and ProgressBar docs, saying it would fetch docs for the components in play. The Input props table showed only label and error, which does not explain missing autofill. It loaded this story together with ProgressBar's 'Mealdrop Checkout Steps', probably to see how the design system's own checkout form sets up fields. The story showed a form with two headed sections and Inputs using only label, defaultValue and error. With no autofill-related props in sight, the agent went into the package types and bundle for Input.

> Let me fetch docs for the components in play.

#### c266 · stories-full · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-7` · story call 1 of 4 in the run · tool call 9 of 77 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** How does the design system's own checkout form use Input: does it pass autocomplete, type or name, and how are the steps grouped?

**Reason.** After reading the checkout components the agent said it would check the docs for the relevant components and fetched Input and ProgressBar. Input's props table listed only label and error, leaving open whether autofill hints or other native attributes can be passed. It loaded this story first, then the ProgressBar steps story, probably to see what the design system's own checkout form gives each Input and how it groups the steps. The story showed a form with headed sections and Inputs with label, defaultValue and error only. The agent then located the package and read Input's declaration and implementation.

> Now let me check the design system docs for the relevant components, and look for existing a11y patterns in the app.

#### c270 · stories-full · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-8` · story call 1 of 4 in the run · tool call 8 of 74 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** Does Droppy's own checkout form pass native attributes like name, type or autocomplete to Input, beyond label and error?

**Reason.** The agent had read the checkout forms and seen both complaints in the code, then checked the Input docs. The prop table listed only `label` and `error`, although the app passes `name`, `value` and `type`. It said it would check the anatomy and Mealdrop-specific stories, and loaded this one first, together with Anatomy. The story showed a real `<form>` with headed sections and Inputs given `label`, `defaultValue` and `error`, but no name, type or autocomplete. That did not settle the question, so the agent read index.d.ts and confirmed there that Input forwards native attributes.

> Let me check the anatomy and Mealdrop-specific stories.

#### c274 · stories-full · 704 · Input / "Mealdrop Checkout Form"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-9` · story call 1 of 6 in the run · tool call 9 of 70 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `adopted`

**Need.** How does Droppy's reference checkout form mark up its fields: form and section structure, headings, and any name or autocomplete attributes?

**Reason.** The agent had read the checkout step components and fetched the Input docs, whose props table showed only label and error. The complaints are that browsers never offer saved details and that users cannot tell the step changed, so it probably wanted the design system's own checkout form as a model for field markup. The story showed a form element with a headed section per step and Inputs carrying only label, defaultValue and error. The agent loaded a label test story next and then read Input's typings and compiled code. Its later edit wraps the fields in a form and adds name and autoComplete.

## Family: undocumented-contract

### native-contract — Story name asserts an unstated native behaviour (50 calls)

The props table is silent on one precise fact about the underlying native element (a hard-coded attribute default, whether it can be overridden, whether refs and native attributes are forwarded). A story, usually a test story, is listed whose name states that fact, and the agent loads it to confirm it.

#### c152 · stories-full · 701 · Select / "Native Control"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-19T23-44-55.651Z/701-new-ui-flow/run-5` · story call 2 of 3 in the run · tool call 33 of 86 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** Is Droppy's Select a native <select>, and how is it driven, for choosing the help type inside the 'Get help' modal?

**Reason.** This was the second of three stories loaded in one burst just before implementation. The order history task includes a help modal where the user picks a type of help from predefined choices, and Select was a candidate for that. The agent probably wanted to know whether Select is a native control and what that implies for values and behaviour. The story's source was just a Select with label, numeric options, value and onChange, which says nothing about the rendered element. The agent then opened the Select implementation in the compiled package, apparently to see the markup for itself.

#### c040 · full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-32-56.740Z/703-fix-bug-flow/run-1` · story call 1 of 1 in the run · tool call 8 of 36 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `high` · outcome `answered_negative`

**Need.** Does Button always render type="button", and does this story show any way to make it submit the surrounding form?

**Reason.** The agent was fixing Enter-to-submit on the two checkout steps and had just read the form components and the Button and Input docs. Among the listed Button stories, this test's name speaks directly to the `type` attribute, so the agent appears to have loaded it to learn how Button behaves inside a form and whether the default can be changed. The source turned out to be a bare Button with an onClick and no `type`. The agent then grepped the app for forms and read the compiled Button in the package, and eventually added a hidden native submit button, stating that Button always renders type="button".

#### c041 · full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-32-56.740Z/703-fix-bug-flow/run-2` · story call 1 of 2 in the run · tool call 9 of 53 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `confirmed`

**Need.** Does Button always render type="button", so it cannot be the submit button that makes Enter work in checkout?

**Reason.** The agent had read the checkout step components and was checking the Button and Input docs before fixing Enter-to-submit. Noticing that Button documents no `type` prop, it loaded the test story whose name speaks directly to that, and Mealdrop Checkout Actions immediately afterwards in the same burst. The returned source was only a bare Button, but the agent treated the story's existence as confirmation that Button renders type button. It later wrote a SubmitOnEnter helper whose comment cites this test story as the reason a separate native default button is needed.

> Important: `Button` has no documented `type` prop, and there's a story named "Test Defaults To Type Button".

#### c043 · full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-32-56.740Z/703-fix-bug-flow/run-3` · story call 1 of 1 in the run · tool call 8 of 62 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `high` · outcome `no_new_info`

**Need.** Does Button default to type="button", and could a type="submit" override make Enter submit the checkout form?

**Reason.** The task was to make Enter work on both checkout steps. The agent had read the form components and fetched the Button and Input docs. Button's props table had no `type`, and the story list contained a test named for a type=button default, which probably signalled that Droppy buttons do not submit forms unless told to. The agent loaded it as the only story of the run. The source was a bare Button with no assertion, so the agent read ButtonProps and the compiled Button in the package, then announced that both steps would get a real form so Enter submits natively.

#### c044 · full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-32-56.740Z/703-fix-bug-flow/run-4` · story call 1 of 3 in the run · tool call 8 of 50 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** Does Button default to type="button", and is there any way to make it a form's submit button?

**Reason.** The agent had diagnosed that the checkout fields sit in a div rather than a form and was checking the Button and Input APIs before wiring one up. On seeing no `type` in Button's props and a test story about the default type, it said it would check that story. The source was a bare Button with no assertion, so it loaded the checkout form story next and then read the package typings and compiled code, where it found the type set to button. It later wrote a submit-on-Enter helper whose comment cites Button's fixed type. This was the first of three story loads.

> Important: Button's documented props have no `type`, and there's a test story named "Test Defaults To Type Button". Let me check it.

#### c047 · full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-32-56.740Z/703-fix-bug-flow/run-5` · story call 1 of 2 in the run · tool call 8 of 56 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** Does Droppy's Button default to type="button", so that wrapping the checkout fields in a <form> alone would not make Enter submit?

**Reason.** The agent was fixing Enter on checkout and had read the step components, then the Button and Input docs to see how submit behaviour is supported. It noticed the props list had no type and that a story named the default type, and said it would check it because that determines whether a form wrapper alone would work. The snippet showed a bare Button. Input's 'Mealdrop Checkout Form' was loaded together with it, straight afterwards. The agent called the default type an important finding, confirmed it in the package source, and wrote a SubmitOnEnter helper whose comment cites the story asserting the default.

> Let me check it, since that determines whether a `<form>` wrapper alone would work.

#### c049 · full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-44-48.066Z/703-fix-bug-flow/run-1` · story call 1 of 1 in the run · tool call 8 of 39 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** Does Button really default to type="button", with no documented way to make it the form's submit button?

**Reason.** The agent had found the checkout fields sit in a `<div className="form">` and was checking the Button and Input APIs. It flagged that Button documents no `type` and that a test story is named for the default type, and said it would verify before designing the fix. The story's source is a bare `<Button onClick>` with no assertion, so the name carried the claim. The agent then read the technical guidelines, grepped the package dist and printed Button's implementation, and wrote a hidden native ImplicitSubmitButton, commenting that Button hardcodes `type="button"` and exposes no `type` prop.

> Important: `Button`'s documented props have no `type`, and there's a test story named "Defaults To Type Button".

#### c050 · full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-44-48.066Z/703-fix-bug-flow/run-2` · story call 1 of 2 in the run · tool call 8 of 36 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** Does Button always render type="button", so that it cannot submit a form wrapped around the checkout fields?

**Reason.** After finding that both checkout steps use a div with onClick buttons, the agent read the Button and Input docs and said it would verify Button's `type` behaviour before designing the fix. This test's name pointed straight at that behaviour. The returned source is just `<Button onClick={fn()}>Order now</Button>` with no assertion, so it could not show the rendered type or whether it can be overridden. The agent loaded the Input checkout-form story alongside it, then went to the package dist and grepped for `type: "button"`, apparently to get the proof the story body lacked.

> Let me verify the Button's `type` behavior before designing the fix.

#### c052 · full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-44-48.066Z/703-fix-bug-flow/run-3` · story call 1 of 2 in the run · tool call 9 of 35 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `confirmed`

**Need.** Can a Droppy Button ever be a form's submit button, or does it always render type="button"?

**Reason.** The agent had read the checkout step components and was checking the Button and Input APIs before making Enter submit each step. Seeing no `type` in Button's props and a story named after the default type, it said it would verify, and loaded this story together with Input's Mealdrop Checkout Form. The source was a bare Button without any assertion. The agent nevertheless declared it confirmed that a Droppy Button cannot be a form's submit button, checked the app for existing form patterns, and implemented real forms with a hidden native submit button.

> Important signal: Button's props don't include `type`, and there's a story named "Test Defaults To Type Button".

#### c054 · full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-44-48.066Z/703-fix-bug-flow/run-4` · story call 1 of 2 in the run · tool call 8 of 41 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `high` · outcome `no_new_info`

**Need.** Does Button render type="button" by default, so it cannot act as a form's default submit button on Enter?

**Reason.** Working on Enter-to-submit for the checkout steps, the agent had read the multi-step form and then the Button and Input docs. The Button props omitted `type`, and one test story was named for a type=button default. Whether the visible buttons can be submit buttons determines how a form-based fix must be built, so the agent probably loaded the story to see that behaviour demonstrated. It loaded the Input checkout-form story in the same burst. The source was just a bare Button, and the agent went on to read ButtonProps in the type declarations and the compiled Button implementation.

#### c056 · full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T20-44-48.066Z/703-fix-bug-flow/run-5` · story call 1 of 1 in the run · tool call 8 of 33 · before first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Is Button's type fixed to "button", or can a Droppy Button submit the checkout form when Enter is pressed?

**Reason.** The agent had read the checkout page and both step components and said it would check the design-system docs for Button and Input. With the Enter-key bug in mind, the relevant fact is whether a Droppy Button can be a submit button. Button's story list included a test named "Test Defaults To Type Button", and the agent loaded it straight after the two docs pages, probably to see what the default is and whether it can be overridden. The source was a bare Button with `onClick`. The agent then located the package and read ButtonProps and the compiled Button.

> Now let me check the design system docs for Button and Input.

#### c112 · purge-jsdoc · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-1` · story call 1 of 2 in the run · tool call 8 of 43 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** Does Button default to type="button", with no way to make it the submit button of the checkout form?

**Reason.** The agent had diagnosed that both checkout steps render fields in a plain div, so Enter has no form to submit, and was checking the Button and Input APIs before wrapping them in a form. Seeing no `type` prop and this test's name, it loaded the story to decide whether a design-system Button could be the submit button. The source is only a bare `<Button onClick>`, with no assertion shown, but with the name the agent took it as proof that Button stays `type="button"`. It then wrote a visually hidden native submit button. The Input checkout-form story was loaded in the same burst.

> Let me check it — this decides whether a real submit button is possible.

#### c114 · purge-jsdoc · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-10` · story call 1 of 1 in the run · tool call 8 of 48 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `confirmed`

**Need.** Does Button always render type="button", meaning it cannot serve as a form's default submit button?

**Reason.** Working on Enter not submitting checkout, the agent had read the form code and then the Button and Input docs. Button's props showed no `type`, and a test story's title suggested the type defaults to button. The agent loaded it, apparently to confirm that Button cannot submit a form. The source was only a bare Button, but the agent took the story as confirmation: it said a test story confirms Button always renders type button, concluded the form would have no default submit button, and wrote a hidden native submit button without checking the package source in the steps shown.

> Key constraint from the docs: Droppy's `Button` has a closed prop set (`clear`, `round`, `large`, `icon`, `iconSize`, `disabled`, `children`, `onClick`) with **no `type` prop**, and a test story confirms it always renders `type="button"`.

#### c115 · purge-jsdoc · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-2` · story call 1 of 2 in the run · tool call 8 of 45 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** Does Droppy's Button default to type="button", and therefore not submit a form when the checkout steps are wrapped in one?

**Reason.** Before changing the checkout forms, the agent read the Button and Input docs. It flagged as important that Button's documented props have no type and said it would check the 'Defaults to type button' story. The purpose is therefore stated: learn Button's native type behaviour before making Enter submit. The snippet showed a bare Button with onClick. Input's 'Mealdrop Checkout Form' was loaded together with it, straight afterwards. The agent then searched the package declarations and bundle for the button type, and finally consulted the technical guidelines for a documented form-submission pattern. No later edit appears in the packet.

> Let me check the "Defaults to type button" story.

#### c117 · purge-jsdoc · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-3` · story call 1 of 2 in the run · tool call 8 of 69 · before first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `high` · outcome `no_new_info`

**Need.** Does Droppy Button hard-code type="button", or can it serve as the submit button of a real form?

**Reason.** The agent had concluded that Enter does nothing because the fields sit in a div rather than a real form, and said it would check the Button and Input APIs. The Button docs showed no `type` prop and listed this test story. A form's implicit submission depends on a submit button, so the agent probably wanted to learn whether Droppy's Button defaults to type=button and whether that can change. It loaded this story together with the Input checkout-form story. The source was a bare Button with no assertion, so the agent grepped the compiled package for type="button" and read the Button implementation.

> Let me check the design system's Button and Input APIs.

#### c119 · purge-jsdoc · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-4` · story call 1 of 2 in the run · tool call 8 of 50 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `confirmed`

**Need.** Does Button default to type="button" with no way to make it a submit button for the checkout form?

**Reason.** The agent had named the root cause, fields in a div instead of a form, and was checking the Button and Input APIs before changing anything. Button's props had no `type` and a test story was named after the default type, so it said it would check it, loading Input's Mealdrop Checkout Form in the same burst. The source was a bare Button. The agent then declared it confirmed that Button defaults to type button and cannot submit, and wrapped each step in a real form with a hidden native submit button, leaving the Droppy Buttons untouched.

> Important: Button's documented props have no `type`, and there's a test story named "Test Defaults To Type Button".

#### c121 · purge-jsdoc · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-5` · story call 1 of 1 in the run · tool call 8 of 36 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `confirmed`

**Need.** Does Droppy Button always render type="button", leaving a form without a default submit button for Enter?

**Reason.** The task was to make Enter submit both checkout steps. After reading the checkout code the agent fetched the Button and Input docs; Button's props had no `type` and one listed test story was named for a type=button default. The agent loaded it, apparently to confirm that a Droppy Button cannot be the form's default submit button. The story source was only a bare Button, but the agent later said the story confirmed that Button always renders type="button", and it then built a hidden native submit button to restore implicit submission rather than relying on the design-system Button.

> Droppy's `Button` exposes no `type` prop and always renders `type="button"` (confirmed by the `Test Defaults To Type Button` story), so a form containing one has no default button — I'll restore implicit submission with a hidden native submit button.

#### c122 · purge-jsdoc · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-6` · story call 1 of 2 in the run · tool call 8 of 31 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** Does Button render type="button" by default, and can it ever act as a submit button for implicit form submission?

**Reason.** The agent had traced the bug to both checkout steps being a `<div>` with Inputs and a click-only Button, so the browser has no implicit submission. Before adding a `<form>` it checked Button's API, saw no `type` prop and noticed a test story named for defaulting to type button. It said it wanted to confirm what that meant for implicit submission and loaded it, with the Input checkout-form story straight after. The source showed only a bare Button with `onClick`. The agent then grepped the compiled package and confirmed there that Button hardcodes `type="button"`.

> Let me confirm what that means for implicit form submission.

#### c124 · purge-jsdoc · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-7` · story call 1 of 1 in the run · tool call 8 of 54 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** Does Button default to type="button", and can it be given type="submit" so Enter submits the checkout form?

**Reason.** The agent was fixing Enter not submitting on checkout and had read the step components. On fetching Button docs it noted that the documented props have no `type` and that a test story about type defaults exists, and said it would check it. The source was just `<Button onClick>` with no type or assertion shown, so the question stayed open. The agent then grepped the package's bundled code and type declarations and concluded from there that Button sets type="button", before looking at the app's form styles ahead of restructuring the steps.

> Button's documented props have no `type`, and there's a test story about type defaults. Let me check that.

#### c125 · purge-jsdoc · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-8` · story call 1 of 1 in the run · tool call 8 of 34 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `confirmed`

**Need.** Does Button always render type="button", meaning it can never be the checkout form's submit button?

**Reason.** The agent had identified the root cause as checkout fields living in a div rather than a form, and was reading Button and Input docs before the fix. Button's props had no `type`, and the story list contained one literally named after the default type, so it said it would verify and loaded it. The source was only a bare Button, yet after also reading the technical guidelines the agent declared it confirmed that Button always renders type button. It then created an ImplicitSubmitButton, a hidden native submit control, and began wiring it into the step forms.

> Important: Button's documented props have no `type`, and there's a story literally named "Test Defaults To Type Button".

#### c126 · purge-jsdoc · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-43-17.926Z/703-fix-bug-flow/run-9` · story call 1 of 1 in the run · tool call 8 of 51 · before first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `high` · outcome `no_new_info`

**Need.** Does Droppy's Button always render type="button", or can it act as the submit button of a checkout form?

**Reason.** The agent was fixing Enter-to-submit on checkout and had said it would check the Button and Input props. The Button docs showed a closed props list with no `type`, and among the undisplayed stories one test was titled after the default type. Loading it was probably meant to see the assertion and learn whether the type could be overridden. The returned source was only a plain Button with an onClick and no assertion, so the agent went to the package typings and compiled source to settle it, and later wrote a hidden native submit button citing Button's fixed type.

> Now let me check the design system docs for Button and Input props.

#### c206 · stories-full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-1` · story call 1 of 2 in the run · tool call 8 of 45 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** Does Button default to type="button" with no way to change it, which would block implicit submission of a real form?

**Reason.** The agent had found that both checkout steps use a div instead of a real form, so Enter cannot submit, and checked the Button and Input APIs before changing anything. It remarked that Button's documented props have no `type` and that a story is literally named for a type=button default, and said it would check those and the checkout-specific stories. This load and the checkout-actions load followed as a pair. The story source was only a bare Button, so the agent searched the installed package, read ButtonProps and found `type: "button"` in the compiled Button.

> Button's documented props have no `type`, and there's a story literally named "Test Defaults To Type Button".

#### c208 · stories-full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-10` · story call 1 of 2 in the run · tool call 8 of 49 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** Does Button default to type="button", and can it be made a submit button once the fields are wrapped in a <form>?

**Reason.** The agent had identified that both checkout steps wrap their inputs in a div and had fetched the Button and Input docs. Seeing no `type` among Button's props, it said it would check the story named after the type default together with the checkout-specific stories. The source was a bare Button with no assertion. It loaded the checkout actions story next, in the same burst, and then turned to the package typings and repeatedly grepped the compiled code for where the type is set, which suggests the story had not settled whether the type can be overridden.

> Button's documented props have no `type`, and there's a story literally named "Test Defaults To Type Button". Let me check that and the checkout-specific stories.

#### c210 · stories-full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-2` · story call 1 of 3 in the run · tool call 8 of 53 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** Does Button always render type="button", meaning a plain form wrapper would not make the checkout buttons submit?

**Reason.** The agent had traced the bug to inputs living in a div rather than a form and was checking the Button and Input APIs before changing anything. It noticed Button has no `type` prop and that a story is named for the default type, and said it would check before assuming a form wrapper is enough. It loaded this test with Mealdrop Checkout Actions. The source is a bare Button, but the agent read it as a documented, tested guarantee that Button renders `type="button"`. It then confirmed this in the package dist and wrote a StepForm with a hidden submit button.

> Let me check those before assuming a `<form>` wrapper is enough.

#### c213 · stories-full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-3` · story call 1 of 4 in the run · tool call 9 of 51 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `high` · outcome `answered_negative`

**Need.** Does Button default to type="button", so it would not submit a form on Enter in the checkout steps?

**Reason.** Fixing Enter-to-submit on checkout, the agent had read ContactDetails and DeliveryDetails and fetched the Button and Input docs. The Button props table had no type prop, yet a test story named the default type. With no narration, the purpose is inferred: it needed to know whether Droppy's Button can submit a form. This was the first of four stories loaded in this stretch, followed at once by 'Mealdrop Checkout Actions'. The snippet showed a bare Button with onClick only. The agent then read ButtonProps in the package d.ts and searched the bundle for type:"button", before wrapping each step in a form.

#### c217 · stories-full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-4` · story call 1 of 3 in the run · tool call 8 of 44 · before first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `high` · outcome `confirmed`

**Need.** Does Button default to type="button", so the existing checkout Buttons cannot trigger implicit form submission?

**Reason.** The agent had diagnosed that checkout inputs were not in a form and that buttons relied on onClick, then read the Button and Input docs. It announced that two stories looked directly relevant and fetched this one and Mealdrop Checkout Actions together. Given the missing `type` in the props table, the test story's name promised the answer on whether Button could submit. The source was a bare Button, but the agent reported that a design-system test asserts the default type, confirmed in the package bundle that it is hardcoded, and later added a hidden submit button.

> Two stories look directly relevant.

#### c220 · stories-full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-5` · story call 1 of 2 in the run · tool call 8 of 35 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** Does Button default to type="button", so a real form around the checkout fields would have no submit button unless type is set?

**Reason.** The agent had traced the bug to the checkout fields sitting in a plain div and planned to introduce a real form. Checking the Button docs, it saw no `type` prop and a story named after the type default, and said it would check the relevant stories before assuming anything. The source was a bare `<Button onClick>`, so the default was not demonstrated. After also loading Mealdrop Checkout Actions it said it would confirm how Button renders, read the package's bundled code and types, and found the default type can be overridden.

> Button's documented props have no `type`, and there's a story literally named "Test Defaults To Type Button". Let me check those relevant stories before assuming anything.

#### c222 · stories-full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-6` · story call 1 of 2 in the run · tool call 8 of 51 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `high` · outcome `no_new_info`

**Need.** Does Button always render type="button", meaning the checkout steps have no submit button for Enter?

**Reason.** The agent was fixing Enter-to-submit on the checkout steps and had just read the form code and the Button and Input docs. The Button props table had no `type`, and the story list named a test for a type=button default. It loaded that story and, immediately after, the checkout-actions story, probably to establish whether Droppy buttons can ever be a form's default button. The source was a bare Button, so the agent searched the compiled package and found `type: "button"` in the implementation. Its later submitOnEnter helper states that the design system's Button always renders as type="button".

#### c224 · stories-full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-7` · story call 1 of 3 in the run · tool call 8 of 45 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** Does Button default to type="button" with no `type` prop, so it cannot be the checkout form's submit button?

**Reason.** The agent had found both checkout steps render a div with onClick buttons and no form, then read the Button and Input docs. It called out two critical details, that Button has no `type` prop and that a story is named for its default type, and loaded that test with two Mealdrop stories in one burst. The source is a bare Button, but the agent concluded Button defaults to `type="button"`, so a form containing only such buttons has no submit button and Enter will not submit. It verified this in the package and wrote a native ImplicitSubmitButton.

> Two critical details: `Button` has no `type` prop and there's a story literally named "Test Defaults To Type Button".

#### c227 · stories-full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-8` · story call 1 of 2 in the run · tool call 8 of 38 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** Does Button default to type="button", and is a caller's type="submit" forwarded so Enter can submit the form?

**Reason.** The agent had found that the checkout fields sit in a plain div, so Enter triggers no implicit submission, and checked the Button and Input docs before changing anything. It then said that Button exposing no `type` prop and the existence of this story were two important signals, and loaded it along with the checkout-actions story. The source was only a bare Button, which did not show whether `type` is forwarded. The agent therefore verified against the installed package, found ButtonProps extends native button props with rest spread after the default, and later wrote `<Button type="submit">`.

> Two important signals: `Button` exposes no `type` prop, and there's a `Test Defaults To Type Button` story.

#### c229 · stories-full · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-9` · story call 1 of 3 in the run · tool call 9 of 45 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `confirmed`

**Need.** Does Droppy's Button always render type="button", so that it cannot act as the submit button of a checkout form?

**Reason.** The agent had traced the Enter bug to checkout fields sitting in a div instead of a form, and was checking the Button and Input APIs before changing anything. Button's props table had no `type`, so a test story named after the default type looked like the place to learn whether a Droppy Button could ever submit. It was loaded in one burst with Mealdrop Checkout Actions and Input's Mealdrop Checkout Form. The source was only a bare Button with no assertion; the agent took the name as the constraint and went to the installed package to verify how the component renders.

> Button's documented props have no `type`, and there's a story named "Test Defaults To Type Button".

#### c061 · full · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T23-05-41.335Z/704-fix-a11y-flow/run-3` · story call 2 of 2 in the run · tool call 22 of 62 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** Does Button force type="button", or could the checkout's step buttons become submit buttons inside a real form?

**Reason.** This is the second story load in the run, after the opaque checkout-steps story. The agent had been reading the package's compiled code to learn why autofill fails and had just fetched the Button docs. The props table listed no `type`, and one test story was named for a type=button default. The agent probably wanted to know whether the checkout buttons could submit a real form, which matters for restructuring the steps. The story showed only a bare Button with no assertion, so the agent immediately grepped ButtonProps in the type declarations and read the Button implementation in dist.

#### c062 · full · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T23-05-41.335Z/704-fix-a11y-flow/run-4` · story call 1 of 1 in the run · tool call 14 of 49 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** Does Button default to type="button", and can callers override it so checkout steps can use a real submitting form?

**Reason.** The agent was fixing checkout accessibility and had said the docs surfaced the root causes, then checked app-level patterns before changing anything. It fetched Button and Heading docs; Button's props table had no `type`, and a test story was named for a type=button default. It probably wanted to know how Droppy buttons behave inside a form, since making each checkout step a real form helps both announcements and autofill. The story showed only a bare Button, so the agent went straight to the package's type declarations for ButtonProps and then to the Input and ProgressBar types and compiled code.

#### c064 · full · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T23-05-41.335Z/704-fix-a11y-flow/run-7` · story call 1 of 1 in the run · tool call 29 of 49 · after first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `medium` · outcome `unclear`

**Need.** Does Button default to type="button", so it would not submit if the checkout steps were turned into real forms?

**Reason.** The agent had reproduced the accessibility complaints with a throwaway walkthrough test and said it would check the remaining component APIs before fixing. After fetching the Button docs, which listed no `type` prop, it loaded this test story, probably to learn whether Droppy Buttons default to type button and so would not submit a real form. The source was a bare Button without an assertion. It then fetched Heading docs and inspected Button's implementation in the bundle. Its later rewrite of ContactDetails uses form events, but the buttons' markup is not visible in the packet.

> Let me check React version and the remaining component APIs before fixing.

#### c066 · full · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-full-opus-high/2026-08-19T23-05-41.335Z/704-fix-a11y-flow/run-8` · story call 2 of 2 in the run · tool call 15 of 59 · before first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `medium` · outcome `confirmed`

**Need.** Does Droppy's Button render type="button" by default, so step buttons would not submit a <form> wrapped around the checkout fields?

**Reason.** The agent had found that each checkout step is a <div className="form"> and was grepping styles to see whether that class mattered, which suggests it was preparing to turn the wrappers into real forms. It had said it would check the Button API. The story name promised the one fact that matters for a form: the button's default type. Loaded shortly after the ProgressBar checkout story, it returned only a plain Button with onClick and no type prop or assertion. The agent did not dig into Button further and later rewrote ContactDetails around a styled form with a submit handler.

> Let me check the React version and Button/Heading APIs.

#### c128 · purge-jsdoc · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-55-56.178Z/704-fix-a11y-flow/run-3` · story call 1 of 2 in the run · tool call 12 of 35 · before first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `medium` · outcome `unclear`

**Need.** Does Button default to type="button", and so how will the checkout buttons behave once the fields sit inside a real form?

**Reason.** For the accessibility task the agent had read the checkout steps and was fetching docs for the components involved. It had already grepped for a `.form` class, which suggests it planned to turn the div-based steps into real forms so browsers could offer autofill. With Button's props showing no `type`, it appears to have loaded this test to learn how design-system Buttons behave inside a form. The source is a bare Button with no assertion. It loaded the Input checkout-form story at the same time, then said it had what it needed and rewrote both steps with form submit handlers.

> Now let me fetch the design system docs for the relevant components.

#### c130 · purge-jsdoc · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-55-56.178Z/704-fix-a11y-flow/run-4` · story call 1 of 1 in the run · tool call 13 of 38 · before first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `medium` · outcome `unclear`

**Need.** Does Droppy Button render type="button" by default, so the checkout step buttons would not submit a wrapping form?

**Reason.** The agent was auditing the checkout flow for accessibility and autofill problems and had read the step components, the Input and ProgressBar docs and the accessibility guidelines. The Button docs it had just fetched showed a props table with no `type` and listed this test story by name. It probably wanted to know whether Droppy buttons could act as submit buttons if the fields were wrapped in real form elements. The story returned only a bare Button render with no assertion, and the agent moved on to global styles and typography docs, so the packet does not show how it used the answer.

> Let me fetch the design system docs for the relevant components.

#### c136 · purge-jsdoc · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-55-56.178Z/704-fix-a11y-flow/run-7` · story call 2 of 3 in the run · tool call 14 of 41 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** Does Button default to type="button", meaning a checkout step wrapped in a form needs an explicit submit type?

**Reason.** Loaded immediately after the Button docs and just before the Input checkout-form story, while the agent was still gathering facts for the accessibility fixes. The agent later wrote a step-form hook that handles a submit event, so at this point it was probably checking whether Button would act as a submit button inside a form. The source was a plain `<Button onClick>` with nothing about type. The agent went on to Heading and Body docs and the app's form styles, then wrote the hook and a new ContactDetails.

#### c138 · purge-jsdoc · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-jsdoc-opus-high/2026-08-20T11-55-56.178Z/704-fix-a11y-flow/run-8` · story call 1 of 1 in the run · tool call 19 of 65 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** Does Button render type="button" by default, and so how would it behave inside a real checkout form?

**Reason.** The agent was deep in an accessibility audit of checkout, having found Input's autoComplete default in the compiled package. It fetched the Button and ErrorBlock docs, then tried to print Button's source from dist with a script that produced no output. It appears to have fallen back on the listed test story to learn how Button sets its type, which matters if the checkout steps become real forms. The story was only a bare Button. The agent next decided to run the app and walk the flow to see the rendered DOM; its later rewrite of ContactDetails uses FormEvent and KeyboardEvent handlers.

#### c235 · stories-full · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-1` · story call 4 of 5 in the run · tool call 33 of 56 · after first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Does Button render type="button" by default, so it would not submit a <form> wrapped around the checkout fields unless told otherwise?

**Reason.** The agent had rendered the checkout in happy-dom, confirmed both complaints, and said it would check the remaining component APIs before fixing. It fetched Button and Heading docs, then loaded this story and a Heading test story together. The walkthrough had shown no form element, so the agent was probably planning a real form and needed to know how the step buttons would behave inside it. The story was a bare Button with onClick. The agent then grepped the Button, Body and Heading declarations in the package types and read the compiled Button.

> Let me check the remaining component APIs before fixing.

#### c236 · stories-full · 704 · Heading / "Test Forwards Ref And Props"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-1` · story call 5 of 5 in the run · tool call 34 of 56 · after first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `medium` · outcome `confirmed`

**Need.** Does Heading forward a ref and native props like id or tabIndex, so focus can be moved to the new step's heading?

**Reason.** Loaded together with the Button type test, after the agent reproduced both complaints and said it would check the remaining component APIs. Users could not tell the checkout had advanced, and a common remedy is moving focus to the new step's heading, which needs a ref and attributes such as tabIndex. Heading's documented props list none of these, so the agent probably loaded this test to see whether they are forwarded. The story passed a native id to a level-2 Heading. The agent then checked HeadingProps in the package types; its later edits are not shown.

> Let me check the remaining component APIs before fixing.

#### c242 · stories-full · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-10` · story call 6 of 8 in the run · tool call 26 of 57 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** Does Button render type="button" by default, so it would not submit once the checkout steps become real forms?

**Reason.** The agent was auditing checkout accessibility and, judging by what it wrote later, intended to turn each step into a real form. It had just fetched the Button docs and grepped ButtonProps in the package typings. The story's name spoke to whether Droppy Buttons inside a form would submit it, which is probably why it was loaded; no narration accompanies the call. The source was a bare Button with no assertion. The agent next checked for form class styles and later wrote real form elements, but the packet does not show the buttons' final markup.

#### c255 · stories-full · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-4` · story call 5 of 6 in the run · tool call 37 of 63 · after first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** Does Button render type="button" by default, so that it would not submit a surrounding form unless told to?

**Reason.** The agent had just walked the checkout in a test DOM and confirmed the complaints, including that the steps contain no form element. It said it would check error wiring and the Button API, fetched Button docs, and saw no `type` among the props. This test story's name addressed the default type directly, so it was loaded together with Mealdrop Checkout Actions. The source was a plain `<Button onClick>` with no type shown. The agent then read Button's implementation and type declarations in the package, presumably to see whether type can be overridden for a submit button.

> Let me check error-state wiring and the Button API.

#### c260 · stories-full · 704 · Heading / "Test Forwards Ref And Props"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-5` · story call 4 of 5 in the run · tool call 45 of 62 · after first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `confirmed`

**Need.** Does Heading forward a ref and native props such as id or tabIndex, so focus can move to the step heading?

**Reason.** Having confirmed that nothing announces the move to the delivery step, the agent was preparing its fix and fetched the Heading and Button docs. Heading's prop table listed only `className`, `size` and `level`, but a test story was named for forwarding ref and props. It loaded that and Button's type-button test together, probably to check that a ref and attributes like `id` or `tabIndex` reach the heading so focus can be sent there on step change. The story showed `id` passed to Heading. The agent checked HeadingProps in index.d.ts, then wrote StepIndicator using `useRef` and `useEffect` with Heading.

#### c261 · stories-full · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-5` · story call 5 of 5 in the run · tool call 46 of 62 · after first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `answered_negative`

**Need.** Does Button default to type="button", so a real `<form>` around the checkout fields needs an explicit submit type?

**Reason.** Loaded together with Heading's ref-forwarding test, just before the agent began writing its fixes. Part of the plan, visible in its later narration, was to wrap each checkout step in a real `<form>` for autofill. Inside a form, a button's type decides whether it submits, and Button's docs showed no `type` prop but listed a test about defaulting to type button. The agent probably wanted to see that default and whether it can be overridden. The story was a bare Button with `onClick`. The agent then read ButtonProps in index.d.ts and went on to rewrite ContactDetails with a form.

#### c264 · stories-full · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-6` · story call 3 of 4 in the run · tool call 18 of 62 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `confirmed`

**Need.** Is Button's type="button" default a tested, documented behaviour, so wrapping checkout steps in a form will not make its buttons submit?

**Reason.** By this point the agent had read Input's and ProgressBar's package types and had just printed the compiled Button code and the ButtonProps declaration, apparently checking how Button behaves if the checkout steps become real forms. The Button docs listed this test story by name only. Loading it looks like a cross-check of what the bundle probably showed, a hard-coded type, against documented behaviour. The story showed a plain Button with onClick and no type prop. The agent moved straight on to Heading, loading 'Test Forwards Ref And Props' next, then ran the app, and later edited MultiStepForm.

#### c265 · stories-full · 704 · Heading / "Test Forwards Ref And Props"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-6` · story call 4 of 4 in the run · tool call 20 of 62 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `high` · outcome `adopted`

**Need.** Does Heading forward a ref and extra native props such as id or tabIndex, so focus can be moved to the step heading?

**Reason.** Users reported not noticing the move to delivery details, and a common remedy is to move focus to the new step's heading, which needs a ref and focus-related attributes on Heading. The agent had just fetched the Heading docs, whose props table showed only className, size and level. It loaded this test story immediately afterwards, right after the Button type story, apparently to confirm that refs and arbitrary props reach the element. The story showed Heading accepting an id. Later edits add a headingRef typed as HTMLHeadingElement in MultiStepForm and a Ref import in StepIndicator, to move focus on step change.

#### c269 · stories-full · 704 · Heading / "Size Decoupled From Level"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-7` · story call 4 of 4 in the run · tool call 70 of 77 · after first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `stated` · confidence `high` · outcome `adopted`

**Need.** Can Heading's visual size be set independently of its semantic level, so heading levels can be corrected without changing appearance?

**Reason.** Late in the run, with the main fixes written and browser checks impossible, the agent looked over the rest of the checkout page and grepped heading levels. The page title was a level-2 heading and no level-1 heading turned up. It fetched Heading docs, saw both size and level props, and loaded the story named for separating them. The story showed `<Heading level={2} size={4}>`. The agent said this confirmed the design system supports the decoupling and immediately changed the page title to `level={1} size={2}` and the step heading to `level={2} size={4}`, keeping the look while fixing the hierarchy.

> Confirmed the DS supports decoupling size from level.

#### c278 · stories-full · 704 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-9` · story call 5 of 6 in the run · tool call 33 of 70 · after first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** Does Button default to type="button", so a Button inside a newly added <form> will not submit it by itself?

**Reason.** After probing the rendered checkout and confirming the problems, the agent said it would check how the design system handles autocomplete and check Button's API. It found Input hard-codes autocomplete off, fetched the Button docs and loaded this test story. It was probably planning to wrap each step in a form, which makes the button's type matter for submission. The source was a bare Button with no assertion. The agent then read the Input implementation and Button's type declarations in the package. Its later edits use a form with an onSubmit handler; how the button is typed there is not shown.

> Let me check how the design system handles `autocomplete` and check Button's API.

#### c161 · stories-full · 706 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-10` · story call 3 of 3 in the run · tool call 26 of 71 · before first edit · story listed in the global listing only · kind `test` · evidence `inferred` · confidence `medium` · outcome `answered_negative`

**Need.** Does Button pass native button attributes such as `type` through to the element, beyond the closed list in its props table?

**Reason.** Well into planning the schedule flow, the agent had read the checkout delivery form and Card docs and listed the package's dist files. It then loaded this test story on its own, about ten calls after the other two Button stories. The date and time grid needs keyboard handling on its buttons, so the agent was probably checking what native attributes Button sets or accepts. The story was a bare Button with onClick. The agent immediately grepped ButtonProps in index.d.ts and read the compiled Button and the Base UI button it wraps, then began implementing.

### indirect-probe — Probe an unrelated story for native-attribute hints (14 calls)

The agent wants to know which element a component renders or whether native attributes or a submit capability reach it, but no listed story is named for that. It opens a structural, catalogue or adjacent-prop story hoping it leaks a hint.

#### c006 · api-ref · 703 · Button / "Variants"

`results/agentic-ref-cc-api-ref-opus-high/2026-08-21T07-37-54.122Z/703-fix-bug-flow/run-2` · story call 1 of 1 in the run · tool call 13 of 40 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `inferred` · confidence `medium` · outcome `answered_negative`

**Need.** Does Button offer any documented variant or prop that makes it a submit button?

**Reason.** The agent had already read the package's compiled Button and types and seen `type: "button"` set in the implementation, and a grep showed the app has no form or submit button. Before designing the Enter fix it loaded the Variants story, probably as a last check of whether the documentation offers any sanctioned submit-style Button. The story showed default, large, clear, icon, round and disabled buttons, none with a type. The agent then wrote an ImplicitSubmit helper whose comment says Droppy's Button always renders type="button" and documents no way to change that, adding a native submit button instead.

#### c007 · basic-docs · 703 · Button / "Anatomy"

`results/agentic-ref-cc-basic-docs-opus-high/2026-08-20T16-54-42.289Z/703-fix-bug-flow/run-1` · story call 1 of 1 in the run · tool call 12 of 39 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `answered_negative`

**Need.** Does any Button story document native attributes such as `type`, given the package types allow them but the props table does not?

**Reason.** The agent was making Enter submit the checkout forms and needed a submit-type Button. The Button docs showed three stories in full and listed only 'Anatomy' without source; the props table had no `type`. It had just confirmed from the package's types and compiled code that extra props are spread onto the button. It probably loaded the one unseen story to see whether the documentation showed the native element or a `type` usage anywhere. The story was a plain Button with an icon. The agent next tried the Getting started and Technical guidelines pages, then used `<Button type="submit">`.

#### c008 · basic-docs · 703 · Button / "Anatomy"

`results/agentic-ref-cc-basic-docs-opus-high/2026-08-20T16-54-42.289Z/703-fix-bug-flow/run-6` · story call 1 of 1 in the run · tool call 15 of 48 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `partial` · confidence `low` · outcome `no_new_info`

**Need.** Does Button's one remaining unseen story reveal anything about its rendered element or a type/submit option beyond the documented props?

**Reason.** The agent was fixing Enter-to-submit on checkout and had noticed that Button documents no `type` prop. It had already gone into the package's type declarations and bundled code to see what Button renders. Before editing, it loaded Anatomy, the single Button story whose source the docs had not shown, probably to make sure the documentation held nothing further about the button element or submit behaviour. The story only showed `icon="cart"` with an onClick handler. The agent checked the app's form styles next and then applied its fix to both steps, apparently relying on what it had read in the package.

> Let me check what it actually renders and look at repo conventions.

#### c009 · basic-docs · 703 · Button / "Anatomy"

`results/agentic-ref-cc-basic-docs-opus-high/2026-08-20T16-54-42.289Z/703-fix-bug-flow/run-9` · story call 1 of 1 in the run · tool call 12 of 32 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** Does the one Button story not yet seen document a form-submit pattern, such as passing type="submit"?

**Reason.** Having found that the checkout inputs were not inside a form, the agent read the Button docs, saw no `type` prop, and confirmed in the installed package that Button defaults to type button while spreading caller props after it. Before relying on that undocumented override it wanted to rule out a documented submit pattern. Anatomy was the only Button story whose source it had not yet seen. It showed just a Button with an icon. The agent then searched the codebase, concluded that neither source documents a submit pattern, and wrote Button with type submit inside a real form.

> Let me check the remaining docs for any documented form-submit pattern before deciding.

#### c141 · stories-api-ref · 703 · Button / "Anatomy"

`results/agentic-ref-cc-stories-api-ref-opus-high/2026-08-19T20-23-33.828Z/703-fix-bug-flow/run-1` · story call 1 of 1 in the run · tool call 12 of 30 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `partial` · confidence `high` · outcome `answered_negative`

**Need.** Do Droppy's Button docs show or sanction a `type` attribute, so a Button can act as a form's submit button?

**Reason.** The agent had diagnosed that the checkout fields sit outside a `<form>`, so Enter submits nothing, and was about to wire one up. Step two has two buttons, so it mattered whether Droppy's Button can take `type`. The docs listed a closed prop set without it, while index.d.ts showed native button props passing through. It said it would check the docs entries before relying on that, and loaded Anatomy, the one unseen story about the control's structure. The story showed only `onClick` and `icon`. The agent tried other docs pages and then wrote an Enter-key helper instead.

> Let me check the docs entries before deciding whether I can rely on it.

#### c142 · stories-api-ref · 703 · Button / "Anatomy"

`results/agentic-ref-cc-stories-api-ref-opus-high/2026-08-19T20-23-33.828Z/703-fix-bug-flow/run-4` · story call 1 of 1 in the run · tool call 8 of 33 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** How does Button's underlying <button> behave inside a form: does any story show its type or submit behaviour?

**Reason.** Fixing Enter on the checkout steps, the agent read the Button and Input docs to see which props exist, especially type for submit. It noted that Button has no documented type prop and said it would check the story docs and the shipped types to see how the underlying button behaves inside a form. With no story about type on offer in this listing, Anatomy was the closest to a structural description. It showed only a Button with onClick and a cart icon. The agent then located the package, read ButtonProps in index.d.ts and the compiled Button code. No later edit is shown.

> Let me check the story docs and the shipped types to see how the underlying `<button>` behaves inside a form.

#### c143 · stories-api-ref · 703 · Button / "Class Name"

`results/agentic-ref-cc-stories-api-ref-opus-high/2026-08-19T22-04-08.900Z/703-fix-bug-flow/run-2` · story call 1 of 1 in the run · tool call 11 of 30 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Is passing attributes outside Button's documented props (such as `type`) a documented pattern, as the className story's pass-through might indicate?

**Reason.** The agent had found that the checkout steps had no form and that Button's documented API lacked `type`, while the package types allowed native button props. It said it would check whether native-prop passthrough was a documented convention, then fetched the Getting started page and this story together. The story's description, about className merging rather than replacing, was probably the nearest documented case of an extra attribute reaching the button. It showed only className. The agent's next remarks cite the Getting started page; it then looked for precedent in the app and applied its fix, with the typecheck accepting `type` on Button.

> Let me check whether native-prop passthrough is a documented convention.

#### c144 · stories-api-ref · 703 · Button / "Anatomy"

`results/agentic-ref-cc-stories-api-ref-opus-high/2026-08-19T22-04-08.900Z/703-fix-bug-flow/run-3` · story call 1 of 1 in the run · tool call 8 of 45 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** Do the remaining Button stories show a `type` attribute or any native-prop passthrough on the rendered button?

**Reason.** The agent had read the checkout form components and the Button and Input docs, and noted that Button's documented props do not include `type`. It said it would check the remaining Button stories and how the real component renders. Of the six stories listed without source it loaded only Anatomy, probably as the one most likely to show the element's full shape. It shows `<Button onClick icon="cart">` and nothing about type. The agent moved straight to the package dist, found `type: "button"` hardcoded in Button, and later wrote a StepForm that handles Enter explicitly because the steps have no submit button.

> Let me check the remaining Button stories and how the real component renders.

#### c145 · stories-api-ref · 703 · Button / "Anatomy"

`results/agentic-ref-cc-stories-api-ref-opus-high/2026-08-19T22-04-08.900Z/703-fix-bug-flow/run-4` · story call 1 of 2 in the run · tool call 12 of 44 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `stated` · confidence `high` · outcome `confirmed`

**Need.** Is passing native attributes such as `type` through Button documented in any of the stories not yet seen?

**Reason.** The agent had already verified in the shipped source that Button hardcodes `type="button"`, and said it would check the remaining stories in case native passthrough was documented anywhere. Of the six stories listed without source it loaded Anatomy and Class Name together. Anatomy probably looked like the place a full, annotated button would appear. It shows only `<Button onClick icon="cart">`, with nothing about type. The agent concluded there is no documented `type` prop and kept to documented props, adding a hidden native submit button to the form rather than passing `type` to Button.

> Let me check the remaining stories in case native passthrough is documented anywhere.

#### c146 · stories-api-ref · 703 · Button / "Class Name"

`results/agentic-ref-cc-stories-api-ref-opus-high/2026-08-19T22-04-08.900Z/703-fix-bug-flow/run-4` · story call 2 of 2 in the run · tool call 13 of 44 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `stated` · confidence `medium` · outcome `confirmed`

**Need.** Does the Class Name story show Button forwarding props beyond its documented list, hinting that `type` could be passed too?

**Reason.** Loaded together with Anatomy under the same stated aim: checking the remaining stories for any documented native passthrough, after the package source had shown Button hardcoding `type="button"`. Class Name was probably picked because className is not in the props list the agent had recited, so the story might reveal how Button treats extra props. It shows only that a className merges with the component's own class, and nothing about `type`. The agent then stated there is no documented `type` prop, said it would use only documented props, and wrote a hidden native submit button for the form.

> Let me check the remaining stories in case native passthrough is documented anywhere.

#### c216 · stories-full · 703 · Button / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-24-59.258Z/703-fix-bug-flow/run-3` · story call 4 of 4 in the run · tool call 17 of 51 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** Does Button's Anatomy story expose anything about the rendered element, such as a type attribute or pass-through native props?

**Reason.** This was the last of four stories the agent loaded while working out how to make Enter submit the checkout steps, directly after Input's 'Mealdrop Checkout Form'. It had already loaded the type-default test and the checkout-actions example and inspected the package bundle. The purpose is not stated; it probably wanted one more look at Button's structure before relying on it inside a form. The story showed only a Button with onClick and a cart icon, essentially what the earlier snippets showed. The agent moved on to CheckoutPage and wrapped each step in a form.

#### c010 · basic-docs · 704 · Button / "Anatomy"

`results/agentic-ref-cc-basic-docs-opus-high/2026-08-21T07-46-25.655Z/704-fix-a11y-flow/run-10` · story call 1 of 1 in the run · tool call 17 of 43 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** What does Button's one unseen story show about the control, in particular any `type` or submit behaviour for the checkout forms?

**Reason.** Working on checkout accessibility, the agent had fetched the Input, ProgressBar and Button docs and then opened the package to read ButtonProps and Button's compiled implementation, probably to learn whether Button can serve as a form's submit control. Anatomy was the only Button story the docs had listed without source, and it loaded it next, apparently to complete its picture of the component rather than to answer a new question. The story showed a Button with `onClick` and a cart icon, nothing about `type`. The agent went on to the Heading docs and the Input and ProgressBar sources.

#### c147 · stories-api-ref · 704 · Button / "Anatomy"

`results/agentic-ref-cc-stories-api-ref-opus-high/2026-08-19T22-50-35.043Z/704-fix-a11y-flow/run-2` · story call 1 of 1 in the run · tool call 12 of 28 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** What does Button's Anatomy story show about the rendered control: its element, parts and any native attributes such as type?

**Reason.** In the accessibility task the agent had fetched ProgressBar, Input and Button docs and then read the three components' declarations in the package d.ts, apparently to learn which native attributes each accepts. It then loaded Button's Anatomy story with no explanation. It probably wanted to see the control's actual structure, perhaps its type attribute, before placing step buttons inside real forms. The story showed only a Button with onClick and a cart icon. The agent went on to read Input's compiled source, Heading and Body docs, and then rewrote StepIndicator and MultiStepForm; no later edit names Button.

#### c271 · stories-full · 704 · Input / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-8` · story call 2 of 4 in the run · tool call 9 of 74 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** What parts and props make up Input, and does its anatomy expose the native input for name, type or autocomplete?

**Reason.** Loaded in the same burst as "Mealdrop Checkout Form", right after the agent noticed that Input documents only `label` and `error` while the checkout passes `name`, `value` and `type`. It had said it would check the anatomy and Mealdrop-specific stories. Anatomy appears to have been picked to see the component's structure and whether the underlying control takes native attributes. It returned a single Input with a label and an error message, nothing beyond the documented props. The agent then opened the package's index.d.ts and confirmed from the types that Input forwards native input attributes.

> Let me check the anatomy and Mealdrop-specific stories.

### bounds-behaviour — Behaviour rule at value limits (5 calls)

The props table gives bounds or defaults but not what the component does at an edge (disable, clamp, wrap, whether zero is reachable). The agent loads the story whose name states the rule.

#### c184 · stories-full · 702 · QuantityStepper / "Bounds Disable Rather Than Clamp"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-2` · story call 2 of 3 in the run · tool call 14 of 35 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** At its min and max, does QuantityStepper disable its buttons rather than clamp, and can the quantity ever reach 0?

**Reason.** Still before any edit, the agent was working out how the basket should behave once its Select became a QuantityStepper. The cart-line story had returned only a hidden helper, so it loaded two more stepper stories together, this one and aria-label. This name promised an account of what happens at the limits, which matters because a stepper whose min is 1 cannot express removing a dish. The source only passed value 1, min 1 and max 2 to a hidden StepperDemo. The agent then read the JSDoc in the package's index.d.ts and searched the app for remove actions, so the story alone apparently did not settle it.

> Let me read the basket and fetch the design system guidance.

#### c188 · stories-full · 702 · QuantityStepper / "Bounds Disable Rather Than Clamp"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-3` · story call 3 of 3 in the run · tool call 17 of 40 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** What does QuantityStepper do at its min and max, and what would that mean for quantities in the cart?

**Reason.** By now the agent had read the package README and the typings, whose JSDoc contrasts QuantityStepper with NumberField. A Select offers a fixed list of amounts, so how the stepper treats its limits probably mattered for swapping one for the other in the cart. This story's title promised the rule for bounds. Its source only passed min 1 and max 2 to a demo wrapper, which added nothing to the props table. The agent went back to the typings, then read the cart state and callers, and afterwards changed the cart menu to import QuantityStepper instead of Select. Third of three stepper stories.

#### c198 · stories-full · 702 · QuantityStepper / "Bounds Disable Rather Than Clamp"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-7` · story call 3 of 4 in the run · tool call 16 of 34 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** At its min and max, do QuantityStepper's buttons disable rather than clamp or wrap, and how are bounds set?

**Reason.** The agent was still researching before replacing the cart's quantity control, and had just read NumberField docs after two unhelpful stepper stories. This story's name describes what happens at the limits, so it probably wanted to know how a stepper in the cart behaves at its minimum and maximum. It was the third of four stepper stories loaded in this phase. The source showed only a StepperDemo wrapper with min 1 and max 2, both props already documented. The agent then listed cart files, loaded the aria-label story and read the stepper's implementation in the bundle.

#### c202 · stories-full · 702 · QuantityStepper / "Bounds Disable Rather Than Clamp"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-8` · story call 3 of 3 in the run · tool call 19 of 43 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** How does QuantityStepper behave at min and max: do the buttons disable, and can a basket line be stepped below one?

**Reason.** Third QuantityStepper story of the run, loaded eight calls after the first two. The cart-line and Anatomy stories had been opaque, and a search of the installed package found no MDX guidance. The agent had just re-read the cart reducer and hooks, so it was probably working out how a stepper in the basket should behave at its limits, for example whether an item can be stepped down to removal. The story showed only a StepperDemo call with min={1} and max={2}, adding nothing beyond the documented min and max props. The agent then traced ShoppingCartMenu's usage and read QuantityStepper's type declaration.

#### c205 · stories-full · 702 · QuantityStepper / "Bounds Disable Rather Than Clamp"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-9` · story call 3 of 3 in the run · tool call 13 of 33 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does QuantityStepper behave at its min and max, and would those limits suit quantities in the cart?

**Reason.** Third stepper story in the run. After two opaque stories, an empty component browser page and a failed search for MDX files, the agent was still short of guidance on the stepper. The cart currently uses a Select with a fixed range, so how the stepper handles its limits was probably the remaining practical question for a swap. The source only passed min 1 and max 2 to a demo wrapper, which the props table already implied. The agent then located the installed package and read the typings, including the Select and stepper declarations, before examining the cart's callers.

### classname-hook — className as styling escape hatch (3 calls)

Built-in styles do not cover what is needed, so the agent checks whether the component accepts className (and extra attributes) to restyle or position it from outside.

#### c149 · stories-full · 701 · Badge / "Class Name"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-19T23-44-55.651Z/701-new-ui-flow/run-1` · story call 1 of 1 in the run · tool call 27 of 86 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** Can Badge take a className to restyle it, so cancelled, on-the-way and delivered orders get distinct badge colours?

**Reason.** Deep in pre-implementation research for the order history page, the agent had read many component docs and had just listed the design system's colour tokens, which show badge colours for a default and a positive variant. The task needs three statuses told apart at a glance, so the agent probably wanted to know whether Badge could be recoloured through a class. The story showed className used only to add a margin. Immediately afterwards the agent grepped the Badge rules in the package stylesheet and the palette tokens, which suggests it was still working out how an override would behave. No later edit naming Badge is recorded.

#### c151 · stories-full · 701 · IconButton / "Class Name"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-19T23-44-55.651Z/701-new-ui-flow/run-5` · story call 1 of 3 in the run · tool call 32 of 86 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `inferred` · confidence `low` · outcome `unclear`

**Need.** Does IconButton accept a className and extra attributes, so an order's actions-menu trigger can be styled and positioned?

**Reason.** Near the end of its research phase the agent loaded three stories back to back: this one, Select's Native Control and Badge's Class Name. It was about to build order rows with an actions menu and status badge, so it was probably checking how far these small controls can be customised from app code. This story showed IconButton taking a className that adds a margin, along with aria-label and onClick. The agent next inspected Select and Badge in the compiled package and later the IconButton styles. Its files were then written through shell commands, so the use made of this is not visible.

#### c153 · stories-full · 701 · Badge / "Class Name"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-19T23-44-55.651Z/701-new-ui-flow/run-5` · story call 3 of 3 in the run · tool call 34 of 86 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** Can Badge be restyled through className so cancelled, on-the-way and delivered orders get different colours?

**Reason.** Third in a burst of three story loads before implementation. The agent had earlier listed the colour tokens and seen badge colours for a default and a positive variant, while the task wants cancelled, on-the-way and delivered orders told apart. It probably loaded this story to see how a custom class combines with Badge's own styling. The source only applied a margin through className. The agent immediately grepped the compiled Badge, found the positive variant switch, and looked up the badge colour token values, so the real answer came from the package source. It then began implementing via shell-written files.

## Family: second-look

### reload-isolate — Re-load a printed story to isolate a fact (18 calls)

The fact the agent needs was already on screen inside a long docs page that printed every story. The agent loads the one story again to isolate, re-read or confirm it.

#### c069 · purge-docgen · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-29-05.414Z/702-rework-ui-flow/run-2` · story call 1 of 1 in the run · tool call 18 of 53 · before first edit · story already shown in full · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info` · coders split: example-model, reload-isolate, reload-isolate

**Need.** How does the design system's cart-line example lay out a QuantityStepper per dish, including any control for removing a line?

**Reason.** The agent had decided the basket should use QuantityStepper and was gathering what it needed to rewrite the rows, including Icon and Button docs. The stepper docs had already displayed every story, this one included, so the re-load was probably a check for fuller source of the cart-line example, perhaps the helper behind it. The single-story view again returned only `<CartLines />`. The agent then looked at spacing tokens and the QuantityStepperProps declaration in the package, and wrote its own basket row with a QuantityStepper and a separate remove action.

#### c071 · purge-docgen · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-29-05.414Z/702-rework-ui-flow/run-4` · story call 1 of 1 in the run · tool call 9 of 45 · before first edit · story already shown in full · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's cart-line example let a user remove a dish when QuantityStepper cannot go to 0?

**Reason.** The agent had read in the guidelines that dish quantity calls for QuantityStepper in both places and said it would check how the cart handles quantity 0 before converging. It read the cart reducer and then reloaded this story, although the docs had already printed it, probably hoping to see inside the `<CartLines />` helper for a removal pattern. Only the wrapper came back, with nothing new. The agent then announced it needed a separate remove affordance and consulted Button and Icon docs and the header wiring, so the removal design came from its own reasoning.

> Let me check how the cart handles quantity 0 (currently "remove" via the Select) before converging.

#### c072 · purge-docgen · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-29-05.414Z/702-rework-ui-flow/run-5` · story call 1 of 1 in the run · tool call 15 of 43 · before first edit · story already shown in full · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does the Mealdrop cart-line example wire QuantityStepper per dish (props, labels, any remove control), given the docs had no props table?

**Reason.** The agent had read the 'Choosing components' guidance, the basket code, the cart reducer and the full QuantityStepper and Select docs, and was close to rewriting the basket row. The QuantityStepper docs had already printed this story, so the load is a second look. Probably the docs showed only the <CartLines /> wrapper and the agent hoped the single-story endpoint would reveal the row composition. It returned the same wrapper. The agent went on to check Icon and Button docs and the package declaration of QuantityStepper, then wrote ShoppingCartMenu with QuantityStepper.

#### c073 · purge-docgen · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-29-05.414Z/702-rework-ui-flow/run-6` · story call 1 of 1 in the run · tool call 8 of 29 · before first edit · story already shown in full · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does Droppy's cart-line example place and wire QuantityStepper for each dish in a basket?

**Reason.** The agent had found that the dish modal uses QuantityStepper while the basket sidebar uses Select, and had read the stepper docs and the Choosing components guide. Those docs already contained this story, so the reload was probably an attempt to see the actual cart-line markup behind what the docs showed, which was likely just a wrapper. The single-story call returned a one-line `<CartLines />`, with imports of Body, Heading and Separator hinting at the layout but no JSX. The agent then went back to the app's cart and header code and fetched Button, Icon and Select docs.

#### c074 · purge-docgen · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-29-05.414Z/702-rework-ui-flow/run-9` · story call 1 of 1 in the run · tool call 13 of 63 · before first edit · story already shown in full · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info` · coders split: example-model, reload-isolate, reload-isolate

**Need.** How does the design system's cart-line example place QuantityStepper in a basket row, and what else does the row contain?

**Reason.** The agent had located both quantity UIs, read the choosing-components guidance and fetched the QuantityStepper docs, which displayed all stories including this one. After reading the cart slice it re-loaded this story alone, probably to look closely at the reference cart line or to get the source of the helper it renders. The single-story view returned only `<CartLines />` again. The agent then traced where the basket menu is used, read the header props, and fetched Button and Icon docs. No later edit naming the component is shown in the packet.

#### c075 · purge-docgen · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-43-31.040Z/703-fix-bug-flow/run-1` · story call 1 of 1 in the run · tool call 8 of 37 · before first edit · story already shown in full · kind `test` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** Does Button always render type="button", or can it be made a submit button for the checkout forms?

**Reason.** The agent had found that neither checkout step is a `<form>`, so Enter has nothing to submit, and was choosing how to add submission. The Button docs, already printed with every story in full, documented no `type` prop but contained a test story named for defaulting to type button. It said it would dig into that story before deciding how to submit and loaded it on its own, probably to see the assertion. The source was just a bare Button with `onClick`. It then read the technical guidelines and wrote a submitOnEnter helper on the premise that Button is always `type="button"`.

> Let me dig into that before deciding how to submit.

#### c076 · purge-docgen · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-43-31.040Z/703-fix-bug-flow/run-10` · story call 1 of 1 in the run · tool call 8 of 58 · before first edit · story already shown in full · kind `test` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** Does this test story say anything more about Button's default type, i.e. whether a Button can ever submit a form?

**Reason.** The agent had read the checkout form code and fetched the Button and Input docs, which came back as long dumps containing every story's source and no props table. This story had therefore already been shown. It probably reloaded it alone to check whether it carried a description or assertion about the default type, since that decides whether Enter can submit; no narration says so. The response was the same bare Button. The agent then read the technical guidelines and the package's typings and bundle, and later wrote an ImplicitSubmit helper noting Button always renders type button.

> Now let me check the design system docs for `Button` and `Input`.

#### c077 · purge-docgen · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-43-31.040Z/703-fix-bug-flow/run-2` · story call 1 of 1 in the run · tool call 8 of 46 · before first edit · story already shown in full · kind `test` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** Does Droppy's Button default to type="button", and can it be made a submit button for the checkout forms?

**Reason.** The agent had found that the checkout steps have no form element, so Enter has nothing to submit, and went to the Button and Input docs. It remarked that Button has this test story and no documented type prop, and said it would check the story before assuming anything. The full docs output had already included the story, so this was a targeted re-read. It showed only a bare Button with onClick, no type prop and no visible assertion. The agent then went to the package's type declarations and bundle, searching for type:"button" to establish what the component really renders.

> Let me check that story before assuming anything.

#### c078 · purge-docgen · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-43-31.040Z/703-fix-bug-flow/run-3` · story call 1 of 1 in the run · tool call 8 of 85 · before first edit · story already shown in full · kind `test` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** Does the test story assert or show that Button always renders type="button", so it cannot submit the checkout form?

**Reason.** The agent had found the checkout fields in a div and was checking the Button API before wiring up a real form. The Button docs had already printed every story in full, this one included, but inside a 20 KB response with no props documented. It probably reloaded the story to view it in isolation and see whether it carried an assertion or note about the default type. The source was the same bare Button. The agent still cited the story as confirmation, read the technical guidelines, and then verified in the installed package that type button is hardcoded.

> Important detail: Button's documented API has no `type` prop, and there's a test story named "Test Defaults To Type Button".

#### c079 · purge-docgen · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-43-31.040Z/703-fix-bug-flow/run-4` · story call 1 of 1 in the run · tool call 8 of 49 · before first edit · story already shown in full · kind `test` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** Does Button force type="button", or can `type="submit"` be passed so the checkout forms submit on Enter?

**Reason.** The agent had read the checkout form components and said it would check the docs for Button and Input. Both pages came back with every story in full and no props table. For an Enter-to-submit fix the key question is whether Button can be a submit control, and the docs contained a test story named for defaulting to type button. The agent reloaded that story by itself, probably to look at it in isolation and find the assertion. It showed the same bare Button. The agent then read the technical guidelines and the package's ButtonProps, and later added a HiddenSubmitButton.

> Now let me check the design system docs for Button and Input.

#### c080 · purge-docgen · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-43-31.040Z/703-fix-bug-flow/run-5` · story call 1 of 1 in the run · tool call 8 of 43 · before first edit · story already shown in full · kind `test` · evidence `stated` · confidence `high` · outcome `answered_negative`

**Need.** Does Droppy's Button always render type="button", meaning it cannot act as the submit button of a checkout form?

**Reason.** The agent had diagnosed that Enter does nothing because the checkout fields live in a div rather than a form. Reading the Button docs, it noticed there was no type prop and a story named 'Test Defaults To Type Button', and said it would check that story and the technical guidelines before deciding how to wire submission. The docs dump had already printed this story, so the reload was a focused re-read of one snippet. It showed a bare Button with no type. The agent then read the technical guidelines and wrote an ImplicitSubmit helper, a hidden native submit button, because Button always renders type="button".

> Let me check that story and the technical guidelines before deciding how to wire submission.

#### c081 · purge-docgen · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-43-31.040Z/703-fix-bug-flow/run-6` · story call 1 of 1 in the run · tool call 8 of 48 · before first edit · story already shown in full · kind `test` · evidence `inferred` · confidence `high` · outcome `answered_negative`

**Need.** Does Droppy's Button hard-default to type="button", preventing it from submitting a form wrapped around the checkout fields?

**Reason.** The agent was fixing Enter on checkout and had read the multi-step form, then fetched the Button and Input docs, which arrived as long dumps of every story with no props documented. That dump already contained this story, so loading it separately is a re-read; the agent gave no reason. Most likely the story title flagged the question that matters for a form-based fix, and the agent wanted that one snippet in isolation. It showed a bare Button with onClick. The agent then went into the package, read ButtonProps in index.d.ts and found type: "button" hard-coded in the compiled component.

#### c082 · purge-docgen · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-43-31.040Z/703-fix-bug-flow/run-7` · story call 1 of 1 in the run · tool call 8 of 56 · before first edit · story already shown in full · kind `test` · evidence `stated` · confidence `high` · outcome `confirmed`

**Need.** Does Button really default to type="button", with no documented way to make it submit the checkout form?

**Reason.** The agent had found the checkout inputs in a div rather than a form and fetched the Button and Input docs, which in this run printed every story in full but no props. It announced that Button has no documented `type` and that it would check the story named after the type default. That source had already appeared in the long docs output, so the reload was probably a way to look at it in isolation, perhaps hoping for the test's assertions. It returned the same bare Button. The agent declared the default confirmed, then verified it in the package typings and compiled code.

> Two things stand out: Button has no documented `type` prop, and there's a story literally named "Test Defaults To Type Button". Let me check it.

#### c083 · purge-docgen · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-43-31.040Z/703-fix-bug-flow/run-8` · story call 1 of 1 in the run · tool call 8 of 42 · before first edit · story already shown in full · kind `test` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** Can Button's default type="button" be overridden, for example with type="submit", as the story about that default might show?

**Reason.** After reading the checkout forms and the complete Button docs, the agent called the type="button" default an important finding and said it would check that story and whether `type` can be overridden. The story's source had already been shown in the docs output; the agent appears to have re-loaded it to study it alone for signs of an override. It returned the same plain Button with onClick and no `type`. The agent then read the technical guidelines, ButtonProps in the package types and the compiled Button, and concluded from that code that `type` is overridable.

> Let me check that story and whether `type` can be overridden.

#### c084 · purge-docgen · 703 · Button / "Test Defaults To Type Button"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-43-31.040Z/703-fix-bug-flow/run-9` · story call 1 of 1 in the run · tool call 8 of 40 · before first edit · story already shown in full · kind `test` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** What does the 'Test Defaults To Type Button' story show about Button's `type`, and can a Button act as a form's submit button?

**Reason.** The agent was fixing Enter on the checkout steps and had fetched the Button and Input docs, which showed every story in full but documented no props. It said it would check the Button story about `type`. The story had already appeared in that long docs output, so the re-load was probably a way to read it in isolation and look for the assertion behind its title. The result was the same bare Button with onClick. The agent then grepped ButtonProps and the compiled source, and later wrote an Enter key handler, stating that Button always renders type="button".

> Let me check that Button story about `type`, plus look for existing tests and how forms are handled elsewhere in the app.

#### c087 · purge-docgen · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-59-22.485Z/704-fix-a11y-flow/run-2` · story call 1 of 1 in the run · tool call 10 of 48 · before first edit · story already shown in full · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does Droppy's own checkout step indicator use ProgressBar to convey the current step: label, value and max, visible step text?

**Reason.** Gathering design-system docs for the checkout accessibility fix, the agent had just fetched ProgressBar and Progress docs, which already included this story's source. It reloaded it anyway, probably because what the docs showed was a one-line wrapper inside a long output with no props table, and it hoped the single-story call would expose how the reference step indicator labels progress. The reload returned the same `<CheckoutStepIndicator />` wrapper and nothing more. The agent then turned to the package's type declarations, grepping `ProgressBarProps`, and later read the ProgressBar implementation in the dist.

> Now let me fetch the design system docs for the relevant components.

#### c088 · purge-docgen · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-59-22.485Z/704-fix-a11y-flow/run-4` · story call 1 of 1 in the run · tool call 10 of 49 · before first edit · story already shown in full · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does Droppy's own checkout step indicator compose ProgressBar: value/max, label and the step text around it?

**Reason.** The agent was auditing checkout for assistive-technology users and had read the app's StepIndicator, the accessibility guidelines and the docs for both ProgressBar and Progress. The ProgressBar docs had already printed this story, so the reload is a second look: probably the agent wanted the checkout-step example in isolation, hoping for the body of the step indicator rather than the wrapper buried in the long docs dump. It again got only <CheckoutStepIndicator />. It then confirmed that the package exports ProgressBar, inspected the bundle, ran the app, and later rebuilt StepIndicator around ProgressBar.

> Let me fetch the relevant design system docs.

#### c091 · purge-docgen · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-59-22.485Z/704-fix-a11y-flow/run-9` · story call 1 of 1 in the run · tool call 16 of 37 · before first edit · story already shown in full · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** What markup does Droppy's checkout step indicator put around ProgressBar (heading, step text, label) to announce the current step?

**Reason.** The agent had the whole ProgressBar docs page, with every story in full, and had spent several calls reading the package's types for ProgressBar, Button, Input, Heading and Body. Just before writing its fix for the step indicator it reloaded the "Mealdrop Checkout Steps" story, probably to look again at the reference composition, or hoping the single-story view would expand the helper behind it. It returned only `<CheckoutStepIndicator />` and the import list. The agent read more of index.d.ts and the ProgressBar class names, then wrote StepIndicator with Body, Heading and ProgressBar.

> Now let me write the fixes, starting with the step indicator.

### reload-opaque — Re-load an example to see behind a helper (16 calls)

The story had already been displayed, but its source was a one-line call to a helper or wrapper that hid the real markup or API. The agent loads the same story on its own hoping the single-story view shows more.

#### c012 · empty · 701 · Modal / "Empty"

`results/agentic-ref-cc-empty-opus-high/2026-08-19T14-33-33.127Z/701-new-ui-flow/run-1` · story call 1 of 1 in the run · tool call 23 of 98 · before first edit · story already shown in full · kind `autogen-empty` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** How is Modal really composed and controlled (content, title, open/close), beyond the opaque ModalDemo wrapper already shown in its docs?

**Reason.** The agent was surveying design-system docs before building the Order History page, whose Get help action needs a modal with choices and a confirmation. Every component's docs offered a single story called Empty. Modal's had already been shown in full, so this reload probably hoped the story endpoint would reveal more than the docs page did, such as the ModalDemo wrapper or its body; no narration explains it. It returned the same one-line wrapper. The agent fetched Select docs next, then read Modal's implementation in the package bundle and the app's existing FoodItemModal.

#### c013 · empty · 701 · Modal / "Empty"

`results/agentic-ref-cc-empty-opus-high/2026-08-19T14-33-33.127Z/701-new-ui-flow/run-3` · story call 1 of 1 in the run · tool call 24 of 86 · before first edit · story already shown in full · kind `autogen-empty` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** What does Modal's only story actually render: what the ModalDemo wrapper and its body contain, as a model for the Get help modal?

**Reason.** In the middle of a long sweep of component docs for the Order History page, the agent loaded Modal's `Empty` story even though its source had already appeared in the Modal docs. Each docs page visible in this run carried just one `Empty` story, so it probably hoped the story endpoint would expand the hidden wrapper and show how a Modal is filled and opened, which it needs for the Get help flow. The result was the same `<ModalDemo isOpen={false} onClose={fn()}>{body}</ModalDemo>`. It then read the app's existing FoodItemModal and ModalProps in the package types, and later wrote GetHelpModal.

#### c014 · empty · 701 · Modal / "Empty"

`results/agentic-ref-cc-empty-opus-high/2026-08-19T14-33-33.127Z/701-new-ui-flow/run-4` · story call 1 of 1 in the run · tool call 24 of 90 · before first edit · story already shown in full · kind `autogen-empty` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How is Modal opened, closed and filled with content, for building the 'Get help' dialog?

**Reason.** The agent was collecting docs for many components before building the order history page, and in this run each docs page offered just one story called Empty. Modal matters because the 'Get help' action opens one. The Modal docs had already shown this story, so reloading it was probably an attempt to get more complete source than a one-line demo wrapper. It returned the same thing: a ModalDemo helper with isOpen false and a body variable that is not shown. The agent then fetched Toast docs, read the app's existing FoodItemModal, which already uses Modal, and went through the package typings.

#### c015 · empty · 701 · Modal / "Empty"

`results/agentic-ref-cc-empty-opus-high/2026-08-19T14-33-33.127Z/701-new-ui-flow/run-5` · story call 1 of 1 in the run · tool call 25 of 108 · before first edit · story already shown in full · kind `autogen-empty` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How is Modal actually composed (what goes inside it, how it opens and closes) for the planned 'Get help' dialog?

**Reason.** The agent was collecting docs for every component the Order History page might use; each page offered just props and an 'Empty' story. The task requires a 'Get help' modal with selectable choices and a confirmation message. The agent had already seen this story in the Modal docs, so loading it again was probably an attempt to get more than the terse demo, such as the body content or wrapper. The result was the same ModalDemo line with an opaque `{body}`. The agent then read the app's own FoodItemModal, an existing Modal usage, and continued through other component docs.

#### c067 · history-issues · 701 · Modal / "Anatomy"

`results/agentic-ref-cc-history-issues-opus-high/2026-08-20T13-33-45.953Z/701-new-ui-flow/run-8` · story call 1 of 1 in the run · tool call 29 of 104 · before first edit · story already shown in full · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `no_new_info` · coders split: reload-opaque, reload-opaque, reload-isolate

**Need.** What goes inside Droppy's Modal in its reference example, and how are the heading and action buttons arranged?

**Reason.** Still before any edit, the agent was about to build the Get help modal and had just read the app's existing FoodItemModal. Every component doc in this run exposed a single Anatomy story, and Modal's had already been shown in full. The reload was probably an attempt to get more than the docs gave, such as the elided `{body}` content or usage notes. It returned what looks like the same snippet: a Modal with isOpen, aria-label and onClose around `{body}`, plus a note about portalling. Nothing new came of it, and the agent went straight on to implementation, later writing GetHelpModal with its own content wrapper.

#### c139 · stories-api-ref · 701 · ToastProvider / "Children"

`results/agentic-ref-cc-stories-api-ref-opus-high/2026-08-19T09-41-08.069Z/701-new-ui-flow/run-8` · story call 1 of 1 in the run · tool call 27 of 91 · before first edit · story already shown in full · kind `api-ref-prop` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** How is a toast actually raised with `useToast` inside ToastProvider, for example to confirm an order action?

**Reason.** The agent was surveying design-system docs for the Order History feature, fetching a long run of component pages. The Toast page had already printed the Children story in full, but its render only mounts a `CreateToastButton` helper inside ToastProvider, so the `useToast` call that fires a toast is not visible. The agent reloaded Children, probably hoping the single-story view would expose that usage for a confirmation message. It returned the same helper-based snippet. The agent went on to the TopBanner docs and then to the package's type declarations; no later edit shown mentions Toast.

#### c068 · purge-docgen · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-29-05.414Z/702-rework-ui-flow/run-1` · story call 1 of 1 in the run · tool call 16 of 85 · before first edit · story already shown in full · kind `app-example` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** What markup sits behind the cart-line example: how is QuantityStepper placed and labelled per dish in a Mealdrop cart row?

**Reason.** The agent had read the cart menu, cart state and callers and had fetched the full stepper docs, which already included this story's source. It loaded the story again anyway, probably because the docs showed it as a bare helper call and the single-story view might expand it or add context for laying out a stepper in each cart line. The reload returned the same helper plus a one-line description. The agent moved on to the technical guidelines, Select, spacing-token and Sidebar docs, and then rewrote the cart menu with QuantityStepper in place of Select.

#### c070 · purge-docgen · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-29-05.414Z/702-rework-ui-flow/run-3` · story call 1 of 1 in the run · tool call 15 of 38 · before first edit · story already shown in full · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** What does the hidden CartLines helper render: how a basket line pairs QuantityStepper with dish name, price and a way to remove the dish?

**Reason.** The stepper docs in this run printed every story in full, so the agent had already seen this one. It loaded it again just before rewriting the basket sidebar, after reading the cart state, the header and the stepper and Select type declarations. If the docs copy was the same bare `<CartLines />` wrapper, it probably hoped a direct load would reveal the helper and show how a line combines stepper, name, price and removal. Only the wrapper came back. The agent then read spacing tokens and said it would add an explicit remove action, a design it appears to have reached unaided.

> Now I'll update the cart sidebar to use `QuantityStepper`, with an explicit remove action (since `0` in the old `Select` was the only way to drop a line).

#### c283 · when-to-use · 702 · QuantityStepper / "Anatomy"

`results/agentic-ref-cc-when-to-use-opus-high/2026-08-20T16-31-57.728Z/702-rework-ui-flow/run-1` · story call 1 of 1 in the run · tool call 18 of 31 · before first edit · story already shown in full · kind `anatomy` · evidence `partial` · confidence `medium` · outcome `no_new_info` · coders split: reload-opaque, reload-opaque, reload-isolate

**Need.** How is QuantityStepper used in code (value, onChange and aria-label wiring) before putting it into the basket rows?

**Reason.** The agent had finished its review: the restaurant modal uses QuantityStepper, the basket sidebar a Select, and the guidance says both should use the same control, so the basket converges on QuantityStepper. The component docs had already shown the Anatomy story in full, so this reload is a repeat. Probably the agent wanted a last look at a usage example, or its description of the parts, immediately before rewriting the basket row. It got the same <StepperDemo value={1} onChange={fn()} /> wrapper. It then checked Select usages and wrote ShoppingCartMenu with QuantityStepper, apparently relying on the props table.

> So the basket converges on `QuantityStepper`.

#### c024 · empty · 704 · Input / "Empty"

`results/agentic-ref-cc-empty-opus-high/2026-08-20T05-14-32.266Z/704-fix-a11y-flow/run-1` · story call 1 of 1 in the run · tool call 9 of 48 · before first edit · story already shown in full · kind `autogen-empty` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** Does Input accept anything beyond label and error (autocomplete, name, type), as the checkout fields require?

**Reason.** The agent had seen both problems in the checkout code and said it would check the design system's Input and progress components before fixing. Both docs pages were tiny, each with a short props table and a single story called "Empty", already printed. It loaded Input's "Empty" story anyway, probably hoping the story view held more detail about what Input accepts, since autofill depends on attributes the two documented props do not cover. It returned `<Input label="Full name" />` again. The agent left Storybook, found the package under node_modules and read the Input and ProgressBar declarations.

> Let me check the design system's Input and progress components before fixing.

#### c085 · purge-docgen · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-59-22.485Z/704-fix-a11y-flow/run-1` · story call 1 of 1 in the run · tool call 10 of 48 · before first edit · story already shown in full · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** What markup does the design system's own checkout step indicator put around ProgressBar (label, step text, heading) beyond the one-line wrapper?

**Reason.** The agent was fixing checkout accessibility, where users cannot tell the page has moved to delivery details, and the app's StepIndicator uses ProgressBar. The ProgressBar docs had already printed this story in full, but its body is probably just a `<CheckoutStepIndicator />` wrapper with the helper's markup hidden. The agent appears to have requested the story on its own hoping the single-story endpoint would expose how the reference indicator labels and announces the current step. It returned the same one-liner. The agent went on to grep the app, read Button, Heading and Body docs, and later handled ProgressBar motion in global styles.

> Now let me fetch the design system docs for the relevant components.

#### c086 · purge-docgen · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-59-22.485Z/704-fix-a11y-flow/run-10` · story call 1 of 1 in the run · tool call 10 of 46 · before first edit · story already shown in full · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does the design system's checkout step indicator example label and announce step progress with ProgressBar?

**Reason.** The agent was working on the complaint that users cannot tell the checkout has advanced. It had read the checkout components and said it would check docs for relevant components, fetching Input, accessibility guidelines, ProgressBar and Progress, all with stories in full. It then re-loaded this one story it had already seen, probably hoping the single-story view would expose the markup behind the checkout step example. It again returned only `<CheckoutStepIndicator />`. The agent turned to Button docs and the package's type declarations, and later styled ProgressBar inside the app's StepIndicator with a reduced-motion rule.

> Now let me check the design system docs for the relevant components.

#### c089 · purge-docgen · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-59-22.485Z/704-fix-a11y-flow/run-5` · story call 1 of 1 in the run · tool call 10 of 59 · before first edit · story already shown in full · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** What does the hidden CheckoutStepIndicator helper do with ProgressBar: how are the step label and current step exposed?

**Reason.** The agent had read the checkout code, the accessibility guidelines and the Input docs, then said it would check the progress components. The ProgressBar docs in this run already printed every story, including this one, yet it loaded it again straight after the Progress docs. The docs copy was probably just the `<CheckoutStepIndicator />` wrapper, and the agent appears to have hoped a direct load would show how the indicator labels its steps. Only the wrapper came back. It then inspected ProgressBar and Input in the package files and went on to start the app.

> Let me check the progress components and choosing-components guidance.

#### c090 · purge-docgen · 704 · ProgressBar / "Mealdrop Checkout Steps"

`results/agentic-ref-cc-purge-docgen-opus-high/2026-09-07T11-59-22.485Z/704-fix-a11y-flow/run-8` · story call 1 of 1 in the run · tool call 10 of 63 · before first edit · story already shown in full · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** What does the reference CheckoutStepIndicator actually render around ProgressBar, such as heading, step text and accessible label?

**Reason.** The agent was working on the complaint that users cannot tell checkout has moved to delivery details. It had read the app's StepIndicator and fetched docs for Input, the accessibility guidelines, ProgressBar and Progress, all of which printed their stories in full. It then asked for this already-seen story by itself, probably because the docs copy was only a `<CheckoutStepIndicator />` call and it hoped a direct request would reveal the helper's markup. The reply was the same one-liner. The agent moved on to grepping the app for screen-reader utilities and reading more docs, and later rewrote StepIndicator.tsx with its own approach.

> Now let me check the design system docs for the relevant components.

#### c284 · when-to-use · 704 · Input / "Anatomy"

`results/agentic-ref-cc-when-to-use-opus-high/2026-08-21T08-06-08.013Z/704-fix-a11y-flow/run-4` · story call 1 of 1 in the run · tool call 8 of 53 · before first edit · story already shown in full · kind `anatomy` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** Does Input accept native attributes such as autoComplete, name or type beyond its two documented props, label and error?

**Reason.** The agent had read the checkout components and just fetched ProgressBar and Input docs. In this run each component's docs carried a single Anatomy story, already shown in full, and Input's props table had only label and error. Since the fix depends on passing autofill attributes to the input, the agent probably reloaded Anatomy hoping the story call would reveal more about the field's parts or accepted props. It returned a one-liner, `<Input label="Full name" error="Enter your full name" />`. The agent then went to the package's `index.d.ts`, where InputProps extends the native input props.

> Now let me check the design system docs for the relevant components.

#### c285 · when-to-use · 704 · Input / "Anatomy"

`results/agentic-ref-cc-when-to-use-opus-high/2026-08-21T08-06-08.013Z/704-fix-a11y-flow/run-7` · story call 1 of 1 in the run · tool call 9 of 54 · before first edit · story already shown in full · kind `anatomy` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** Does Input accept native attributes such as autocomplete, name and type beyond the documented label and error props?

**Reason.** Fixing checkout accessibility, the agent had read the forms and turned to the design system docs. The Input page showed a two-prop table and one story, Anatomy, already printed in full. It loaded Anatomy again anyway, probably hoping the single-story endpoint would reveal more than the docs page had, such as pass-through of autocomplete or other native attributes. It returned the same one-line render with a label and an error. The agent then left Storybook and grepped the package's index.d.ts for Input and ProgressBar, where the full prop types live.

> Now let me check the design system docs for the relevant components.

## Family: component-basics

### parts-wiring — Parts, slots and basic wiring (14 calls)

The agent needs the component's basic operating model: its parts or slots, which props drive it, how value, handlers, open state and labels are wired. Docs were thin or the example opaque, so it loads a structural story (typically Anatomy) or a basic one.

#### c155 · stories-full · 701 · Modal / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-19T23-44-55.651Z/701-new-ui-flow/run-9` · story call 1 of 2 in the run · tool call 30 of 104 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How is Droppy's Modal composed: which props (isOpen, onClose, aria-label) and does it offer title or footer parts for the 'Get help' dialog?

**Reason.** Building the Order History page, the agent was deep in a long documentation sweep across layout, link and banner components and had just re-read FoodItemModal, the app's existing modal. The task needs a 'Get help' modal with choices and a confirmation message, so it probably wanted Modal's canonical structure before designing that flow. It loaded Modal's Anatomy story and Badge's Anatomy story back to back. The Modal snippet showed isOpen, aria-label and onClose around an opaque {body} placeholder. The agent then read the package's type declarations, including Modal's, and started building the state layer.

#### c156 · stories-full · 701 · Badge / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-19T23-44-55.651Z/701-new-ui-flow/run-9` · story call 2 of 2 in the run · tool call 31 of 104 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `medium` · outcome `answered_negative`

**Need.** What props does Badge take: just text, or a variant/colour option to distinguish cancelled, on-the-way and delivered orders?

**Reason.** Each order in the new Order History list must show a status badge for cancelled, on the way or delivered. Near the end of its documentation sweep the agent loaded Badge's Anatomy story immediately after Modal's, apparently to see how Badge is used and whether it supports different looks per status. The snippet showed only a Badge with text="vegan". The agent then went to the package: it listed the declarations, where Badge takes text and variant, grepped the badge colour tokens and read the Badge CSS rules. After that it said it had everything it needed and began the state layer.

#### c181 · stories-full · 702 · QuantityStepper / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-10` · story call 2 of 3 in the run · tool call 12 of 32 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** What parts does QuantityStepper consist of and how is it meant to be used, given the cart-line example revealed nothing?

**Reason.** Second of three stories in this run, loaded after the cart-line story came back as a hidden helper and after the NumberField docs and the component browser page. The agent was apparently still trying to learn how the stepper is put together and intended to be used before making the basket match the dish modal. Anatomy is the usual place for that. It returned `<StepperDemo value={1} onChange={fn()} />`, the same bare usage as the basic stories. The agent then loaded Select's MealDrop story and went looking in node_modules for MDX or story files.

#### c187 · stories-full · 702 · QuantityStepper / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-3` · story call 2 of 3 in the run · tool call 11 of 40 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** What parts make up QuantityStepper and how is it meant to be operated, compared with the cart's Select?

**Reason.** Still before any edit, the agent was looking for design-system guidance on which quantity control to standardise on. The cart-line story had just come back as an opaque helper, the component browser page was only a shell, and no MDX files were found on disk. Anatomy was probably the next most promising story for seeing how the stepper is put together. It returned another helper wrapper with only value and onChange, which the props table already showed. The agent then turned to the package README, the NumberField docs and the typings. This was the second of three stepper stories it loaded.

#### c190 · stories-full · 702 · QuantityStepper / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-4` · story call 2 of 2 in the run · tool call 11 of 31 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** What are QuantityStepper's parts and intended interaction, as a basis for choosing it over the cart's Select?

**Reason.** The agent had by then read the cart menu, which appears to use Select where the dish modal uses QuantityStepper, and neither component's docs explained when to use which. Having got nothing from the cart-line story, it probably tried Anatomy as the next story likely to describe how the stepper is built and operated. The source was a demo wrapper with value and onChange only. Right afterwards the agent looked for MDX files in the package, opened the component browser page and read the typings and README, which suggests it was still hunting for written guidance. It later replaced Select with QuantityStepper.

#### c193 · stories-full · 702 · QuantityStepper / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-5` · story call 3 of 3 in the run · tool call 11 of 38 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** What does a complete QuantityStepper usage look like: its parts, and how value, onChange and labelling are wired?

**Reason.** Third story load of the run. The cart-line and burger-extras stories had each returned a single wrapper line, and the component browser page had no usable content, so the agent was still without a worked QuantityStepper example. It appears to have tried Anatomy next as the most structural of the remaining stories, the others being single-prop demos and tests. That returned `<StepperDemo value={1} onChange={fn()} />`, another wrapper. The agent then gave up on stories and went to the package, reading its README and the QuantityStepper typings, before editing the cart menu to use QuantityStepper.

#### c195 · stories-full · 702 · QuantityStepper / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-6` · story call 2 of 2 in the run · tool call 9 of 45 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** What parts make up QuantityStepper, and how is the component composed in JSX?

**Reason.** Loaded straight after Mealdrop Cart Line, in the same burst. That story had returned only an opaque CartLines element, so the agent, still looking for how QuantityStepper should be used in the cart, probably turned to Anatomy as the remaining story likely to show the component's structure. It returned a StepperDemo wrapper with value and onChange, both already in the props table and the fully shown stories. The agent then read the NumberField docs, the component browser page, the package README and the typings for QuantityStepper before deciding how to change the cart.

#### c197 · stories-full · 702 · QuantityStepper / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-7` · story call 2 of 4 in the run · tool call 12 of 34 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** What parts make up QuantityStepper and how should it be composed, since the cart-line example showed no JSX?

**Reason.** After the cart-line story returned only an opaque wrapper, the agent read the cart's Select-based menu, the order summary, cart state and the Select docs. It then came back to QuantityStepper and loaded Anatomy, probably hoping for a structural view of the component it was about to place in the cart. This was the second of four stepper stories loaded while researching. It returned a StepperDemo wrapper with value and onChange only, adding nothing to the props table. The agent continued with the component browser page, Header code and NumberField docs.

#### c201 · stories-full · 702 · QuantityStepper / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-8` · story call 2 of 3 in the run · tool call 11 of 43 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `partial` · confidence `low` · outcome `no_new_info`

**Need.** What is QuantityStepper made of and how is it meant to be composed, since the cart-line story hid its markup?

**Reason.** Loaded directly after the cart-line story, as the second of three QuantityStepper stories in the run. The agent was looking for design-system guidance on the right quantity control for the basket, and the cart-line story had exposed nothing but a wrapper. Anatomy probably looked like the next best source for the component's structure and intended use. It returned `<StepperDemo value={1} onChange={fn()} />`, which repeats the controlled value/onChange API already in the props table. The agent then fetched NumberField docs and the component browser page and searched the installed package for MDX documentation.

> Let me check the design system's guidance.

#### c204 · stories-full · 702 · QuantityStepper / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-9` · story call 2 of 3 in the run · tool call 10 of 33 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** What parts make up QuantityStepper and how is it operated, to judge it against Select for the cart?

**Reason.** Second of three stepper stories. The agent had found the two inconsistent quantity controls and was looking for guidance on which the design system prefers; the cart-line story and the Select docs had not provided any. Anatomy was probably tried as the story most likely to explain what the stepper consists of and how it is used. It returned a demo wrapper with only value and onChange. The agent then opened the component browser page, searched the package for MDX files, loaded the bounds story and ended up in the package typings. No later edit naming the component is recorded.

#### c234 · stories-full · 704 · Input / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-1` · story call 3 of 5 in the run · tool call 11 of 56 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `partial` · confidence `medium` · outcome `answered_negative`

**Need.** Which parts does Input render (label, control, error slot) and how are they linked, to judge labelling and where native attributes go?

**Reason.** Third story load of the run, made between opening the design-system package and grepping its type declarations. The agent was auditing checkout accessibility and autofill and had seen that the reference form passes only label and error to Input. It probably hoped an 'Anatomy' story would show how label, control and error message are structured and associated. The story was a single Input with a label and an error. The agent then read InputProps in index.d.ts and the compiled Input and Base UI field control, and went on to run the checkout flow itself.

> Now let me check the design system docs for the components involved.

#### c239 · stories-full · 704 · Input / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-10` · story call 3 of 8 in the run · tool call 11 of 57 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** What parts make up Input (label, control, error slot), and how is the error wired to the control for assistive technology?

**Reason.** The agent was investigating why checkout is hard to follow with assistive technology and why autofill never appears. The checkout-form story had shown only basic Input usage, the step story was opaque, and it had just started locating the package's typings. Anatomy probably looked like the story that would reveal Input's internal parts and how the error message relates to the control. No narration accompanies the call. The source was simply an Input with a label and an error, much like the Error story already shown, so the agent grepped the typings and bundle for the actual wiring.

#### c249 · stories-full · 704 · Input / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-3` · story call 3 of 4 in the run · tool call 12 of 56 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `partial` · confidence `low` · outcome `no_new_info`

**Need.** Which DOM parts does Input render (label, control, error slot), and how are label and error tied to the control?

**Reason.** Third story in the opening burst. The two checkout stories had not shown how Input handles native attributes or how its label and error are wired, and the props table listed only `label` and `error`. The agent had just found the package's type declaration files and, in parallel, loaded Input's Anatomy story, probably to see the parts Input renders before judging its accessibility. The story was a single `<Input label="Full name" error="Enter your full name" />`, no more than the Label and Error stories already shown. The agent then read InputProps in the declarations and the compiled Input, finding autoComplete defaulted to off.

> Let me check the design system docs and existing tests.

#### c253 · stories-full · 704 · Input / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-4` · story call 3 of 6 in the run · tool call 11 of 63 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `partial` · confidence `low` · outcome `no_new_info`

**Need.** What parts make up Input (label, control, error slot), and how are they tied together for assistive technology?

**Reason.** Third story in the burst that followed the Input and ProgressBar docs. The agent was auditing checkout for assistive-technology users and had just seen that the reference checkout form passes only label, defaultValue and error. It probably wanted to know how Input wires its label and error message internally before deciding what the app must add. The story returned `<Input label="Full name" error="Enter your full name" />`, apparently much like the Error example the docs had already shown. The agent next loaded the error-announcement test story and then read Input's implementation in the package.

> Now let me fetch the design system docs for the components involved.

### variant-catalogue — Catalogue of visual variants (10 calls)

The agent needs to know which visual styles a component offers and which props produce them, typically to give two actions different emphasis when there is no variant prop. It loads the catalogue story.

#### c158 · stories-full · 706 · Button / "Variants"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-1` · story call 2 of 2 in the run · tool call 16 of 77 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `partial` · confidence `medium` · outcome `confirmed`

**Need.** Which visual variants does Button have, and is there any secondary style other than `clear` to pair with the primary button?

**Reason.** Loaded right after 'Mealdrop Checkout Actions' in the same docs burst the agent had announced. The task needs a primary and a secondary button in the cart footer. Having seen one example pairing `large` with `clear`, the agent probably wanted the whole range of Button styles to confirm which options exist for the secondary button. The story listed default, large, clear, icon, round-clear and disabled buttons, matching the props table. The agent went on to typography, IconButton, Separator, Card and ScrollArea docs; the packet shows no later edit mentioning Button.

> Now let me fetch the design system docs for the components I'll need.

#### c159 · stories-full · 706 · Button / "Variants"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-10` · story call 1 of 3 in the run · tool call 14 of 71 · before first edit · story listed in the global listing only · kind `showcase-highlight` · evidence `inferred` · confidence `medium` · outcome `confirmed`

**Need.** Which Button variants exist and which props select them, so the cart can show a primary 'Order now' and a secondary 'Schedule delivery'?

**Reason.** The agent had read the cart menu, checkout, header and restaurant code and then fetched Sidebar and Button docs. It loaded 'Variants' and, right after, 'Mealdrop Checkout Actions'. The task needs two cart buttons with different emphasis and the props table has no variant prop, so the agent appears to have wanted the list of Button styles in code. The story showed default, large, clear, icon, round-clear and disabled buttons, the same flags the props table lists. The agent carried on with other docs; its later visible edit styles date options and does not show the footer buttons.

#### c162 · stories-full · 706 · Button / "Variants"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-2` · story call 1 of 2 in the run · tool call 19 of 82 · before first edit · story listed in the global listing only · kind `showcase-highlight` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** Which Button props produce a primary versus a secondary look, given that Button has no variant prop?

**Reason.** Before editing, the agent was preparing to put a secondary "Schedule delivery" button beside a primary "Order now" in the cart sidebar. It appears to have requested the Button docs and two Button stories together, having seen the story names only in the global listing. Button's props (clear, round, large, icon) include no variant option, so Variants was probably chosen to see the full visual vocabulary and pick props for primary and secondary. The story shows default, large, clear, icon, round and disabled buttons. Later edits shown in the packet import Button but do not show the cart footer, so the use is unconfirmed.

#### c164 · stories-full · 706 · Button / "Variants"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-3` · story call 1 of 2 in the run · tool call 12 of 99 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `partial` · confidence `medium` · outcome `unclear`

**Need.** Which Button variants exist, and which props make a primary versus a secondary button for the cart footer?

**Reason.** After exploring the cart and checkout code, the agent said it would fetch docs for the components it needed and pulled Sidebar and Button. The feature requires a primary and a secondary button in the cart footer, but Button has no variant prop, only clear, round and large. It loaded Variants, together with Mealdrop Checkout Actions, probably to see the whole set of styles and decide which reads as secondary. The story showed default, large, clear, icon, round icon-only and disabled buttons in a row. The footer edit is not visible later, so the choice it made cannot be confirmed.

> Now let me fetch the design system docs for the components I'll need.

#### c166 · stories-full · 706 · Button / "Variants"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-4` · story call 1 of 2 in the run · tool call 19 of 85 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `inferred` · confidence `medium` · outcome `confirmed`

**Need.** Which Button variants exist and how are they set through props, so 'Order now' can be primary and 'Schedule delivery' secondary?

**Reason.** After reading the cart, checkout and header code, the agent fetched Sidebar, Button and IconButton docs, then loaded 'Variants' and 'Mealdrop Checkout Actions' together. The task calls for a primary and a secondary button in the cart footer, but the props table has no variant prop. The agent probably wanted to see every Button style in code to decide how to express the two emphases. The story showed default, large, clear, icon, round-clear and disabled buttons, nothing beyond the documented flags. The agent carried on with typography, Card, Badge and Separator docs; no later Button edit is shown.

#### c168 · stories-full · 706 · Button / "Variants"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-5` · story call 1 of 2 in the run · tool call 17 of 87 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** Which visual variants does Button offer, and which one should serve as the secondary style beside a primary button?

**Reason.** Having read the cart sidebar and related state, the agent fetched the Sidebar and Button docs. The task distinguishes a primary from a secondary button, but the props table has no variant or secondary option. The Variants story was probably loaded to see the full set of looks and decide which flag expresses secondary. It showed default, large, clear, icon, round icon-only and disabled buttons, all derivable from the props. The agent loaded the checkout actions story straight after, as a pair, and then read more component docs. The cart footer edit is not shown in the packet.

#### c171 · stories-full · 706 · Button / "Variants"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-6` · story call 2 of 2 in the run · tool call 18 of 97 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `partial` · confidence `medium` · outcome `confirmed`

**Need.** Which visual variants does Button offer, and which props produce a secondary look beside a default primary button?

**Reason.** Loaded immediately after 'Mealdrop Checkout Actions' in the same docs-gathering burst. The agent needed to render 'Order now' as primary and 'Schedule delivery' as secondary, and the props table only lists boolean flags. It appears to have wanted the full catalogue of Button looks to check whether anything other than `clear` could serve as a secondary style. The story showed default, large, clear, icon, round-clear and disabled buttons, all flags it already had from the props table. The agent continued with Body, Heading, Select and other docs without a visible change of plan.

> Now let me fetch the design system docs for the components I'll need.

#### c172 · stories-full · 706 · Button / "Variants"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-7` · story call 1 of 2 in the run · tool call 16 of 79 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** Which Button variants exist, and which props distinguish a primary action from a secondary one?

**Reason.** The agent was preparing to add a secondary Schedule delivery button next to a primary Order now button in the sidebar cart. It had just fetched the Button docs, where the props table listed clear, round and large but nothing called primary or secondary, and story names came without descriptions. Variants probably looked like the quickest way to see every style side by side and decide which props express the two emphasis levels. It was loaded together with Mealdrop Checkout Actions. No narration accompanies the call, and the packet does not show the cart buttons it finally wrote.

#### c174 · stories-full · 706 · Button / "Variants"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-8` · story call 1 of 2 in the run · tool call 17 of 95 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** Which Button variants exist for telling a primary action ("Order now") from a secondary one ("Schedule delivery")?

**Reason.** The agent was planning the schedule-delivery feature, which needs an "Order now" primary button beside a secondary "Schedule delivery" button in the cart sidebar. After reading app state and fetching the Sidebar, Button and Body docs, it saw a props table with clear, round and large but no named primary or secondary option. It loaded Variants, and immediately afterwards the checkout-actions story, probably to see which combinations the design system treats as primary and secondary. The story showed default, large, clear, icon, round and disabled buttons. The packet does not show the footer code the agent eventually wrote.

#### c176 · stories-full · 706 · Button / "Variants"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T00-35-33.644Z/706-new-ui-scheduled-flow/run-9` · story call 1 of 2 in the run · tool call 14 of 83 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** Which Button variants exist, and which should style the secondary 'Schedule delivery' action beside primary 'Order now'?

**Reason.** After a broad read of the app, the agent fetched the Sidebar, Button and Body docs. The cart footer needs a primary and a secondary button, and Button's props expose only boolean flags. The Variants story was probably the quickest way to see every look at once and choose the secondary one. It showed default, large, clear, icon, round icon-only and disabled buttons. The agent loaded the checkout actions story directly afterwards, as a pair, then checked restaurant data and the Button typings. Its first later file imports Button for the scheduling panel; the footer markup is not shown.

### guessed-story — Guessed a story name (3 calls)

The agent requested a story it had never been shown, betting on a conventional name (such as Open) for the state or usage it needed to understand.

#### c280 · when-to-use · 701 · Modal / "Open"

`results/agentic-ref-cc-when-to-use-opus-high/2026-08-20T13-07-23.341Z/701-new-ui-flow/run-10` · story call 1 of 1 in the run · tool call 26 of 80 · before first edit · story never shown (guessed name) · kind `not-in-instance` · evidence `inferred` · confidence `medium` · outcome `answered_negative`

**Need.** How is Modal used when open: its isOpen/onClose wiring and how content is composed inside it for the 'Get help' dialog?

**Reason.** The agent was gathering component references for the order history page, whose 'Get help' action opens a modal with choices and a confirmation. The docs it had fetched each showed a single Anatomy story, and it had just started looking at the package's type declarations. It appears to have guessed that Modal would have an 'Open' story showing the dialog in use. The server answered that no such story exists and that only Anatomy is available. The agent loaded no other story in the run; it went on reading the package typings and other component declarations instead.

#### c281 · when-to-use · 701 · Modal / "Open"

`results/agentic-ref-cc-when-to-use-opus-high/2026-08-20T13-07-23.341Z/701-new-ui-flow/run-5` · story call 1 of 1 in the run · tool call 27 of 108 · before first edit · story never shown (guessed name) · kind `not-in-instance` · evidence `inferred` · confidence `medium` · outcome `answered_negative`

**Need.** How is Modal opened and closed, and which props control its open state, for the "Get help" dialog?

**Reason.** The agent was collecting design-system docs before building the Order History page, whose "Get help" action opens a modal. Every component page it fetched in this run exposed only an Anatomy story. It then asked for a Modal story called "Open", a name that had not appeared in any output, apparently guessing that a story named after the open state would show how the dialog is controlled. The server answered that the story does not exist and that Anatomy is the only one. The agent moved on to other docs pages and then listed the package's type declarations.

#### c282 · when-to-use · 701 · Modal / "Open"

`results/agentic-ref-cc-when-to-use-opus-high/2026-08-20T13-07-23.341Z/701-new-ui-flow/run-6` · story call 1 of 1 in the run · tool call 23 of 154 · before first edit · story never shown (guessed name) · kind `not-in-instance` · evidence `inferred` · confidence `medium` · outcome `answered_negative`

**Need.** How is Modal shown and dismissed, and what controls its open state, for the "Get help" flow?

**Reason.** The agent was working through design-system docs for the Order History page, with Card, Review, Select, Link, Body, Heading, Toast, PageSection and ErrorBlock fetched in sequence, each exposing a single Anatomy story. The task's "Get help" action needs a modal, and the agent requested a Modal story named "Open" that no output had listed, apparently guessing a story for the open state existed. The server replied that only Anatomy is available. The agent then read the app's existing FoodItemModal, which already uses Modal, and the Modal declaration in index.d.ts, and later wrote GetHelpModal.

## Family: accessibility

### a11y-name — How to name the control accessibly (12 calls)

The agent needs to know how a control gets its accessible name and what the name should say: which prop carries it, whether it is visible, the wording the design system uses. It loads the story dedicated to that prop or rule.

#### c150 · stories-full · 701 · Button / "Icon Only Needs A Label"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-19T23-44-55.651Z/701-new-ui-flow/run-10` · story call 1 of 1 in the run · tool call 25 of 91 · before first edit · story listed without source in the component docs · kind `showcase-highlight` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How should an icon-only Button, such as an order's actions-menu trigger, be given an accessible name?

**Reason.** The agent was still surveying the design system before building the Order History page, fetching docs for Icon, Review, Card, Select, PageSection, Heading, Body and Container in a row. The task needs an actions menu on each order, so a compact Button trigger was likely. In the middle of that survey it loaded Button's "Icon Only Needs A Label" story, probably to learn how an icon-only trigger gets its accessible name. The story showed `icon`, `round`, `clear` and `aria-label` together. It later wrote an ActionsMenu built on Button, but the trigger's markup is cut off in the packet.

#### c001 · api-ref · 702 · QuantityStepper / "aria-label"

`results/agentic-ref-cc-api-ref-opus-high/2026-08-20T16-45-40.235Z/702-rework-ui-flow/run-1` · story call 1 of 1 in the run · tool call 16 of 26 · before first edit · story listed in the global listing only · kind `api-ref-prop` · evidence `inferred` · confidence `high` · outcome `adopted`

**Need.** What accessible name should each basket QuantityStepper get through aria-label, and what wording does the design system use?

**Reason.** The task was to align the basket's quantity control with the dish modal. By this point the agent had read both UIs, the QuantityStepper and Select docs, cart state and the stepper's CSS in the installed package, and was about to replace the basket's Select. The docs showed Value, Min and Max in full but only listed the aria-label story. The agent probably wanted the recommended naming for a stepper that repeats per basket row. The story used aria-label="Cheeseburger quantity". After a look at the compiled component, the agent's edit gave each row's stepper aria-label={`${item.name} quantity`}, the same wording pattern.

#### c002 · api-ref · 702 · QuantityStepper / "aria-label"

`results/agentic-ref-cc-api-ref-opus-high/2026-08-20T16-45-40.235Z/702-rework-ui-flow/run-10` · story call 1 of 1 in the run · tool call 17 of 28 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `inferred` · confidence `high` · outcome `adopted`

**Need.** What should QuantityStepper's aria-label contain when each basket line gets its own stepper?

**Reason.** The agent had compared Select and NumberField docs, read the brand guidelines, and reviewed the basket, cart slice, header and dish components. Just before editing, it loaded this one story. Each basket line would get its own stepper, so the agent probably wanted to know how the design system expects the control group to be named. The story showed aria-label="Cheeseburger quantity". The agent then explained that the basket should adopt the stepper and edited the basket to render QuantityStepper with an aria-label built from the item name plus 'quantity', mirroring the story's wording.

#### c003 · api-ref · 702 · QuantityStepper / "aria-label"

`results/agentic-ref-cc-api-ref-opus-high/2026-08-20T16-45-40.235Z/702-rework-ui-flow/run-4` · story call 1 of 1 in the run · tool call 17 of 57 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `inferred` · confidence `high` · outcome `adopted`

**Need.** What should QuantityStepper's `aria-label` say on a cart line, and is it passed straight to the component as a prop?

**Reason.** The agent was making quantity entry consistent by replacing the basket sidebar's Select with QuantityStepper, the control the dish modal already used. It had finished reading the cart code and the stepper's CSS and was one step from editing. The component docs listed an `aria-label` story without source, so it appears to have loaded it to see the expected wording and usage of the accessible name. The story showed `aria-label="Cheeseburger quantity"`. The agent said it would make the change and wrote the stepper with `aria-label={`${item.name} quantity`}`, mirroring that phrasing.

#### c004 · api-ref · 702 · QuantityStepper / "aria-label"

`results/agentic-ref-cc-api-ref-opus-high/2026-08-20T16-45-40.235Z/702-rework-ui-flow/run-8` · story call 1 of 1 in the run · tool call 25 of 47 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `inferred` · confidence `high` · outcome `adopted`

**Need.** How should each basket row's QuantityStepper be named for assistive technology, and what aria-label wording does the design system show?

**Reason.** The agent had spent many calls inspecting the QuantityStepper's CSS and compiled markup, Button and Sidebar styles, and the Header code that renders the basket, and was one step from editing. With several steppers about to appear in one basket, each needs its own accessible name, and the listed aria-label story promised the design system's convention. The story used aria-label="Cheeseburger quantity". The agent's next actions replaced the basket's Select with a QuantityStepper carrying aria-label={`${item.name} quantity`}, the same pattern, and then wired quantity zero to remove the line.

#### c005 · api-ref · 702 · QuantityStepper / "aria-label"

`results/agentic-ref-cc-api-ref-opus-high/2026-08-20T16-45-40.235Z/702-rework-ui-flow/run-9` · story call 1 of 1 in the run · tool call 19 of 28 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `inferred` · confidence `high` · outcome `adopted`

**Need.** What accessible name should a QuantityStepper carry on a cart line, and how is `aria-label` passed to it?

**Reason.** The agent had finished tracing the basket's Select-based quantity control, the cart reducers and the dish modal's remove handler, and was about to switch the basket to QuantityStepper. Its last lookup before editing was the stepper's `aria-label` story, which the docs had listed without source. It probably wanted the expected form of the accessible name. The story showed `aria-label="Cheeseburger quantity"`. The agent then announced it would make the basket match the dish modal, and added `aria-label={`${item.name} quantity`}` to the stepper in both the cart menu and the food item modal.

#### c140 · stories-api-ref · 702 · QuantityStepper / "aria-label"

`results/agentic-ref-cc-stories-api-ref-opus-high/2026-08-19T19-09-57.659Z/702-rework-ui-flow/run-5` · story call 1 of 1 in the run · tool call 24 of 44 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** What should QuantityStepper's aria-label say when a stepper sits on each basket line?

**Reason.** Late in its research, the agent had been digging through the compiled QuantityStepper and its styles in the package, apparently checking how the control would sit in the basket sidebar. Before editing, it loaded this single story. The basket lists several dishes, each needing its own stepper, so the agent probably wanted the expected wording for the accessible name. The story showed aria-label="Cheeseburger quantity". Right afterwards the agent said it had everything it needed and ran a script replacing the basket's Select with QuantityStepper; the script text is truncated, so the label it used is not visible.

#### c185 · stories-full · 702 · QuantityStepper / "aria-label"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-2` · story call 3 of 3 in the run · tool call 15 of 35 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** How should each QuantityStepper be named for assistive technology when one sits on every basket line, and what does an aria-label look like?

**Reason.** Loaded in the same burst as Bounds Disable Rather Than Clamp, shortly after the cart-line story proved opaque. The agent was preparing to put a QuantityStepper on every basket line, so it probably wanted to know how each one should be named for assistive technology; the props table listed aria-label without explanation. The story showed `aria-label="Cheeseburger quantity"`, a dish-specific label. The agent then inspected the package's type declarations and the cart's remove actions. No later QuantityStepper edit is visible in the packet, so whether it copied this labelling pattern cannot be confirmed.

#### c199 · stories-full · 702 · QuantityStepper / "aria-label"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-7` · story call 4 of 4 in the run · tool call 19 of 34 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** What should QuantityStepper's aria-label say: what does it name, and how is it phrased?

**Reason.** Just before this call the agent grepped for the word times and found the cart's current quantity control labelled with the quantity followed by times. Replacing that control with QuantityStepper would need an equivalent accessible name, so it probably loaded the story named after the aria-label prop to see the intended wording. It was the last of four stepper stories loaded in this phase. The example used Cheeseburger quantity. The agent then read the stepper's typings and implementation and rewrote ShoppingCartMenu with QuantityStepper, but the label it chose is cut off.

#### c241 · stories-full · 704 · ProgressBar / "Label"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-10` · story call 5 of 8 in the run · tool call 19 of 57 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** What does ProgressBar's `label` prop do: render visible text, or only give the bar an accessible name?

**Reason.** Loaded immediately after the range test story, in the same burst. That story had passed a label to ProgressBar, and label was the one prop the fully shown stories did not demonstrate, so the agent probably wanted to know whether it renders visible text or only names the bar for assistive technology, which matters for announcing checkout progress. The Label story returned essentially the same element with different label text and no explanation. The agent then read the Progress implementation in the package bundle to see what the prop really does.

#### c268 · stories-full · 704 · ProgressBar / "Label"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-7` · story call 3 of 4 in the run · tool call 22 of 77 · before first edit · story listed without source in the component docs · kind `api-ref-prop` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** What does ProgressBar's `label` prop do: is it a visible caption or only the accessible name, and how is it passed?

**Reason.** Well into its investigation, the agent had read the package declarations for Input, ProgressBar, Button, Heading and Body after the checkout-steps story proved opaque. It then loaded ProgressBar's Label story, apparently to learn how the bar gets an accessible name, which bears on telling screen-reader users which checkout step they are on. The story showed `<ProgressBar value={1} max={3} label="Order preparation" />`. Afterwards the agent read the progressbar implementation in the bundled code, probably to see how label is applied. Its StepIndicator rewrite keeps ProgressBar, but the visible excerpt stops before the props.

#### c275 · stories-full · 704 · Input / "Test Label Names The Control"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-9` · story call 2 of 6 in the run · tool call 10 of 70 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** Does Input's label prop give the control its accessible name, so checkout fields are properly labelled for screen readers?

**Reason.** Loaded right after the checkout form story, as a pair. The agent was reviewing the checkout the way a screen-reader user would experience it, and every field there is an Input identified only through its label prop. It probably wanted to verify how that label is tied to the control before deciding whether labelling needed fixing. The source was a single Input with a label and no assertions, which told it nothing new. The agent then went to the package typings and grepped the compiled Input for aria attributes, and later ran its own probe test to inspect the rendered accessibility output.

### a11y-semantics — Built-in assistive-technology semantics (10 calls)

The agent needs to know what the component exposes or announces to assistive technology without extra work: how an error is announced, whether the message node stays mounted, what role, name or value range is reported.

#### c148 · stories-api-ref · 704 · ProgressBar / "Anatomy"

`results/agentic-ref-cc-stories-api-ref-opus-high/2026-08-19T22-50-35.043Z/704-fix-a11y-flow/run-4` · story call 1 of 1 in the run · tool call 26 of 46 · after first edit · story listed without source in the component docs · kind `anatomy` · evidence `partial` · confidence `medium` · outcome `adopted`

**Need.** How is ProgressBar called and what ARIA does it expose (value, max, label) before it replaces the hand-rolled checkout step bar?

**Reason.** Mid-task, after a scripted audit reproduced both complaints and found no progressbar role and no live region, the agent decided to rewrite the hand-rolled step indicator and said it would first confirm the ProgressBar export and styling hooks. Anatomy, whose note says the track carries the ARIA, gave a minimal real call: `<ProgressBar value={1} max={3} label="Checkout progress" />`. The agent then checked the type declaration and CSS in the package, found the styles identical to the hand-rolled bar, and rewrote StepIndicator importing ProgressBar. The story appears to have supplied the value, max and label call shape for that rewrite.

> Let me confirm the `ProgressBar` export and its styling hooks before rewriting the indicator.

#### c240 · stories-full · 704 · ProgressBar / "Test Reports Its Range"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-10` · story call 4 of 8 in the run · tool call 18 of 57 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** What does ProgressBar report about its range to assistive technology, and how are value, max and label supplied?

**Reason.** By this point the agent had read Input's implementation in the bundle and found where Progress lives there. The earlier checkout-steps story had been opaque, so it still lacked a ProgressBar reference for signalling the current checkout step. This test story's name suggested it would show what the bar reports about its range, which appears to be why it was chosen; it was loaded together with the Label story. The source showed value 1, max 3 and a label reading Checkout progress, without assertions. The agent then read the Progress implementation; its rewritten step indicator is truncated.

#### c243 · stories-full · 704 · Input / "Test Error Is Announced"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-10` · story call 7 of 8 in the run · tool call 32 of 57 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does Input announce a validation error to screen-reader users: a live region, a role, or aria-describedby?

**Reason.** Near the end of its research, the agent had read Input's implementation and several component docs and was about to rewrite the checkout steps with real forms, autocomplete tokens and focus on the first error. It loaded this story together with Test Error Slot Is Always Mounted, probably to confirm how Input surfaces an error to screen-reader users before deciding how much the app must do itself. The source was just an Input with a label and an error, identical to the Anatomy story seen earlier. Straight after the pair it said it had what it needed.

#### c244 · stories-full · 704 · Input / "Test Error Slot Is Always Mounted"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-10` · story call 8 of 8 in the run · tool call 33 of 57 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** Is Input's error element always in the DOM, even without an error, so that later messages appear in an existing node?

**Reason.** Loaded immediately after Test Error Is Announced, in the same burst, just before the agent began rewriting the checkout steps. It had already read Input's implementation in the bundle, so this probably served as a quick check of documented behaviour: whether the error element exists even when there is no error, which affects how newly shown messages reach assistive technology. The source was only an Input with a label, the same as the Label story shown in the docs. The agent then said it had what it needed and wrote the step indicator and form changes.

#### c250 · stories-full · 704 · Input / "Test Error Is Announced"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-3` · story call 4 of 4 in the run · tool call 25 of 56 · before first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does Input expose its error message to assistive technology (live region, role=alert or aria-describedby)?

**Reason.** Late in its investigation, after finding Input's autoComplete default and checking Button and ProgressBar in the compiled package, the agent loaded this test story, the fourth and last story of the run. For an accessibility fix it probably needed to know whether Input already announces validation errors or whether the checkout must add its own live region. The story source was the same one-line Input with label and error seen in Anatomy, with no assertions. The agent then grepped the Field error CSS and the Base UI FieldError implementation in dist, and soon said it had everything it needed.

> Let me check a few more DS components and the app's styles.

#### c254 · stories-full · 704 · Input / "Test Error Is Announced"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-4` · story call 4 of 6 in the run · tool call 12 of 63 · before first edit · story listed without source in the component docs · kind `test` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** How does Input announce a validation error to screen readers: a live region, role alert, or aria-describedby?

**Reason.** Last of four stories loaded together after the Input and ProgressBar docs. The agent was working through checkout as an assistive-technology user would, and probably wanted to know whether Input's error text is announced by the component or whether the app has to add that. The name promised exactly this. The returned source was the same label-plus-error snippet as Anatomy, with no assertions shown. The agent immediately went to the package, grepping the bundled code for aria-invalid and aria-describedby and reading Input's implementation, which suggests the story left the question open.

> Now let me fetch the design system docs for the components involved.

#### c259 · stories-full · 704 · ProgressBar / "Test Reports Its Range"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-5` · story call 3 of 5 in the run · tool call 40 of 62 · after first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `answered_negative`

**Need.** What does ProgressBar expose to assistive technology (value range, accessible name from `label`) when used as a step indicator?

**Reason.** Midway through the run the agent had rendered the checkout in a scratch test, confirmed both complaints and said it would check the validation-error path and the design system's error semantics. After doing that it fetched docs for the separate Progress component, then loaded ProgressBar's "Test Reports Its Range", a name both components list. It probably wanted to know what range and name the bar announces, since the step indicator relies on it. The story showed `value={1} max={3} label="Checkout progress"` with no assertions. The agent immediately read ProgressBar's compiled implementation and CSS, then moved to Heading and Button before rewriting StepIndicator.

#### c272 · stories-full · 704 · Input / "Test Error Is Announced"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-8` · story call 3 of 4 in the run · tool call 15 of 74 · before first edit · story listed without source in the component docs · kind `test` · evidence `stated` · confidence `high` · outcome `no_new_info`

**Need.** How does Input announce its error message to assistive technology: live region, role="alert" or aria-describedby?

**Reason.** After confirming from the package source that Input forwards native attributes and hardcodes `autoComplete="off"`, the agent turned to the second accessibility concern, whether validation errors reach screen-reader users. It said it would check error announcement behaviour and existing tests, and loaded the Input story named "Test Error Is Announced", presumably expecting assertions about roles or live regions. The returned source was only an Input with a label and an error string, identical to Anatomy, with no test body. The agent moved on to look for tests in the repo and then to Heading and ProgressBar.

> Let me check error announcement behavior and existing tests.

#### c277 · stories-full · 704 · ProgressBar / "Test Fill Is Not Announced"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-9` · story call 4 of 6 in the run · tool call 16 of 70 · before first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `unclear`

**Need.** What does ProgressBar expose to assistive technology: is the fill hidden and the bar named by its label?

**Reason.** Loaded straight after the checkout-steps story, as a pair. That story had hidden its markup behind a helper, and the agent still needed to know how ProgressBar presents progress to a screen reader, since the complaint is that the step change is not perceivable. A test titled about the fill not being announced probably looked like the place to see the accessible structure. The source showed a ProgressBar with value 1, max 3 and the label 'Checkout progress', without assertions. The agent then ran the app and a probe test, later read ProgressBar's compiled source, and rewrote the step indicator; the props it used are cut off.

#### c279 · stories-full · 704 · Input / "Test Error Is Announced"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-43-49.007Z/704-fix-a11y-flow/run-9` · story call 6 of 6 in the run · tool call 36 of 70 · after first edit · story listed without source in the component docs · kind `test` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** How does Input announce its validation error to assistive technology: a live region or an aria link to the field?

**Reason.** The agent had already begun editing and was reading Input's compiled implementation and Button's typings. Checkout validation shows errors on the fields when a step is submitted, and for the users in the complaint those errors need to be announced. It probably loaded this test story to learn the mechanism without reverse-engineering minified code. The source was only an Input with a label and an error string. The agent went straight back to the compiled package, grepping for the field error component and progress bar internals, and then fetched the Heading docs, apparently for the step heading it would focus.

## Family: component-choice

### usage-guidance — Mine a story for when-to-use guidance (10 calls)

The agent wants to know what a component is for or when to use it instead of a sibling, and found no written guidance. It loads the component's only or most generic story hoping its description or structure reveals intended use.

#### c011 · do-dont · 702 · QuantityStepper / "Anatomy"

`results/agentic-ref-cc-do-dont-opus-high/2026-08-20T16-22-32.806Z/702-rework-ui-flow/run-4` · story call 1 of 1 in the run · tool call 13 of 26 · before first edit · story already shown in full · kind `anatomy` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** What does QuantityStepper's one story say about its structure and intended use, now that the choosing-components guidance page is unavailable?

**Reason.** The agent was choosing one quantity control for the dish modal and the basket. It had fetched docs for QuantityStepper, Select and NumberField and the technical guidelines, then asked for a choosing-components page that did not exist. Immediately afterwards it re-loaded the stepper's sole story, already seen in the docs, probably looking for any extra description of what the component is for. It returned a one-line description of the group, buttons and live value plus the same StepperDemo snippet. The agent then read the cart slice and header and rewrote the basket with QuantityStepper and a remove action.

#### c016 · empty · 702 · QuantityStepper / "Empty"

`results/agentic-ref-cc-empty-opus-high/2026-08-19T18-45-18.432Z/702-rework-ui-flow/run-3` · story call 1 of 1 in the run · tool call 12 of 53 · before first edit · story already shown in full · kind `autogen-empty` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** Does QuantityStepper's only story reveal usage or guidance on choosing it over Select for quantities, beyond the bare props table?

**Reason.** The agent had found the two quantity controls, a QuantityStepper in the dish modal and a Select in the basket, and said it would check the design system's guidance. The docs it got were minimal: each component page had a props table and one story called "Empty", already shown. After trying Select, the component browser and NumberField, it listed all docs with story ids and then loaded the stepper's "Empty" story directly, probably hoping for more than the docs page gave. It returned the same `StepperDemo` one-liner. The agent turned to the app code and went looking for the package source.

> Let me check the design system guidance.

#### c017 · empty · 702 · QuantityStepper / "Empty"

`results/agentic-ref-cc-empty-opus-high/2026-08-19T18-45-18.432Z/702-rework-ui-flow/run-4` · story call 1 of 1 in the run · tool call 12 of 43 · before first edit · story already shown in full · kind `autogen-empty` · evidence `inferred` · confidence `medium` · outcome `no_new_info`

**Need.** Does loading QuantityStepper's only story reveal any description or usage guidance that the terse component docs lacked?

**Reason.** The agent had seen that the basket uses a Select and the dish modal a QuantityStepper, and was hunting for guidance on which is right. The component docs offered only props and one 'Empty' story; a component-browser page, the NumberField docs and a search for MDX files in the package added nothing. Having just listed all docs with story ids, it loaded QuantityStepper's 'Empty' story even though the docs had already shown it, probably to check whether the story endpoint held more text. It got the same StepperDemo wrapper and went on to the package README and type declarations.

#### c018 · empty · 702 · QuantityStepper / "Empty"

`results/agentic-ref-cc-empty-opus-high/2026-08-19T18-45-18.432Z/702-rework-ui-flow/run-5` · story call 1 of 1 in the run · tool call 12 of 78 · before first edit · story already shown in full · kind `autogen-empty` · evidence `partial` · confidence `low` · outcome `no_new_info`

**Need.** Does QuantityStepper's story say anything about when to use it, rather than Select or NumberField, for order quantities?

**Reason.** The agent had noticed QuantityStepper and NumberField in the listing and said it would review both UIs and the docs. It read the dish modal and the basket, fetched the bare QuantityStepper and Select docs and the component browser page, and looked for .mdx files in the package without success. It had already seen this story in the docs output, so re-loading it was probably an attempt to squeeze more detail or guidance out of the only story available. The result was the same one-line StepperDemo. The agent then searched the package README and fetched the NumberField docs.

> Let me review both UIs and the docs.

#### c019 · empty · 702 · QuantityStepper / "Empty"

`results/agentic-ref-cc-empty-opus-high/2026-08-19T21-24-43.577Z/702-rework-ui-flow/run-1` · story call 1 of 1 in the run · tool call 12 of 39 · before first edit · story already shown in full · kind `autogen-empty` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** Does QuantityStepper's sole story show anything beyond the props table about how or where the stepper should be used?

**Reason.** The agent was comparing the dish modal's QuantityStepper with the basket's Select. It had fetched docs for the stepper, Select, NumberField and the component browser, each thin, and a search for .mdx files in the package printed nothing. Although the docs output had already included this story, the agent loaded it on its own, probably hoping the story view would carry extra description or markup. It got the same StepperDemo line. It then located the installed package, read its README, and later replaced the basket's Select with QuantityStepper.

#### c020 · empty · 702 · QuantityStepper / "Empty"

`results/agentic-ref-cc-empty-opus-high/2026-08-19T21-24-43.577Z/702-rework-ui-flow/run-2` · story call 1 of 1 in the run · tool call 16 of 72 · before first edit · story already shown in full · kind `autogen-empty` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** Does QuantityStepper's only story reveal more about its intended use or markup than the short docs page, to justify using it for basket quantities?

**Reason.** The agent was deciding which control the basket and the dish modal should share. It had pulled docs for QuantityStepper, Select and NumberField, the component browser page, the full listing with story ids and the package README, and found almost no usage guidance. It had already seen this story's source in the docs output, so it probably re-requested it hoping the single-story view would add a description or fuller markup. It returned the same StepperDemo one-liner. The agent then read the cart state and the package's type declarations, and later moved the basket to QuantityStepper.

#### c021 · empty · 702 · QuantityStepper / "Empty"

`results/agentic-ref-cc-empty-opus-high/2026-08-19T21-24-43.577Z/702-rework-ui-flow/run-3` · story call 1 of 1 in the run · tool call 8 of 45 · before first edit · story already shown in full · kind `autogen-empty` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** How is QuantityStepper meant to be used: what does a rendered example look like beyond the bare props table?

**Reason.** The agent had found the two quantity UIs and fetched QuantityStepper and Select docs, which in this run were tiny: a props table and a single story called Empty, already shown. It loaded Empty anyway, probably to check whether the story call held anything more than the docs page, such as a real example or guidance on when to use a stepper. It returned one line, `<StepperDemo value={1} onChange={fn()} />`. The agent then looked elsewhere for guidance, trying the component browser page, NumberField docs and the package README, before replacing Select with QuantityStepper in the cart menu.

#### c022 · empty · 702 · QuantityStepper / "Empty"

`results/agentic-ref-cc-empty-opus-high/2026-08-19T21-24-43.577Z/702-rework-ui-flow/run-4` · story call 1 of 1 in the run · tool call 7 of 71 · before first edit · story already shown in full · kind `autogen-empty` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** How is QuantityStepper meant to be used: does its only story show label, bounds or context beyond the props table?

**Reason.** Early in the run the agent had found the two quantity controls and fetched the QuantityStepper docs, which held only a props table and one story called "Empty", already shown in full. It loaded that story straight away, probably checking whether the story view carried any extra description or usage guidance that would say which modality the design system prefers. The result was the same `StepperDemo` one-liner. The agent then tried Select, the component browser, NumberField and a listing with story ids, still looking for guidance, before returning to the app code and eventually rewriting the cart menu with QuantityStepper.

#### c023 · empty · 702 · QuantityStepper / "Empty"

`results/agentic-ref-cc-empty-opus-high/2026-08-19T21-24-43.577Z/702-rework-ui-flow/run-5` · story call 1 of 1 in the run · tool call 13 of 71 · before first edit · story already shown in full · kind `autogen-empty` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** Does the story-level documentation for QuantityStepper carry any usage guidance or description beyond the terse component page?

**Reason.** The agent had found the Select-versus-QuantityStepper inconsistency and wanted the design system's guidance on which control to use. The component docs were terse, as it said, and its search for a guidelines page turned up only a component browser. After listing every doc with story ids and reading the package README, it loaded the single 'Empty' story for QuantityStepper, although its source had already appeared in the component docs. Probably it was checking whether the story endpoint carried extra description. It returned the same StepperDemo wrapper. The agent then mined the package's type declarations and saved a memory note that the MCP lacks usage prose.

> The component docs are terse — let me check the design system's guidelines doc.

#### c179 · stories-full · 702 · QuantityStepper / "Anatomy"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-1` · story call 2 of 2 in the run · tool call 14 of 48 · before first edit · story listed without source in the component docs · kind `anatomy` · evidence `partial` · confidence `low` · outcome `no_new_info` · coders split: usage-guidance, usage-guidance, parts-wiring

**Need.** How is QuantityStepper structured and controlled, and does its anatomy story carry any guidance on intended use?

**Reason.** Still looking for design-system guidance on the right quantity control for the basket, the agent had loaded the cart-line story (an opaque wrapper), then the NumberField docs and the component browser page, none of which settled the question. It then loaded QuantityStepper's Anatomy story, probably hoping for a fuller picture of the component's parts and intended use. This is the second of two story loads in the run. The source was only a `<StepperDemo value={1} onChange={fn()} />` call, repeating the value/onChange API already in the props table, so the agent moved on to search the installed package for MDX files and read its README.

> Now let me check the design system guidelines.

### example-precedent — In-app example as precedent for component choice (7 calls)

The agent is deciding which component the design system intends for a job (often because the app uses two controls for the same task) and loads an in-app example as evidence of what the design system itself uses.

#### c178 · stories-full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-1` · story call 1 of 2 in the run · tool call 11 of 48 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** Does the design system show QuantityStepper as the control for basket lines, and how is it placed and wired in a cart row?

**Reason.** The agent had just identified the inconsistency (stepper in the dish modal, Select in the basket) and said it would check the design system guidelines. It fetched the QuantityStepper and Select docs, which listed stories by name only. "Mealdrop Cart Line" under QuantityStepper probably looked like evidence of which control belongs in a basket row and how to wire it. The agent loaded it first of two stories from this component. The source was only a `<CartLines />` wrapper, so it kept looking: NumberField docs, the component browser page, the Anatomy story, then the package README.

> Now let me check the design system guidelines.

#### c182 · stories-full · 702 · Select / "Mealdrop Burger Extras"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-10` · story call 3 of 3 in the run · tool call 13 of 32 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** What does the design system use Select for in MealDrop: picking options such as extras, rather than setting a quantity?

**Reason.** Third story of the run, loaded right after the stepper's Anatomy. The agent had to decide which of the two quantity controls should win, and the stepper stories had given it no usage guidance. Select's MealDrop example concerns burger extras, not quantities, so the agent probably wanted to see what Select is meant for, as evidence that the basket's quantity Select is the odd one out. The story returned only `<BurgerCustomiser />`. The agent then searched node_modules for MDX and story files and read the package README, apparently still seeking guidance.

#### c186 · stories-full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-3` · story call 1 of 3 in the run · tool call 8 of 40 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `high` · outcome `no_new_info`

**Need.** How does Droppy's reference cart line let users change a dish's quantity: a QuantityStepper, and with what props and layout?

**Reason.** The agent was comparing the two places quantities are set and had found QuantityStepper in the dish modal and Select in the cart menu. The stepper docs gave props but no guidance on where to use it, and listed a cart-line story without source. That story probably looked like direct evidence of which control the design system intends for cart lines. It returned only an opaque CartLines helper, so the agent kept searching: the component browser page, two more stepper stories, the package README and typings. It later replaced Select with QuantityStepper in the cart menu.

#### c189 · stories-full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-4` · story call 1 of 2 in the run · tool call 8 of 31 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `high` · outcome `no_new_info` · coders split: example-precedent, example-precedent, example-model

**Need.** How does the design system's own cart line present quantity editing: with QuantityStepper, and in what arrangement?

**Reason.** Early in the run the agent had read the dish modal, which uses QuantityStepper, and the cart item component, and had just fetched the stepper docs and grepped for other quantity controls. The task is to make the cart and the dish modal consistent, so a design-system story showing a cart line probably looked like the authoritative answer on which control belongs there. The source was only an opaque CartLines helper. The agent then read the cart menu and Select docs, tried the Anatomy story, and searched the installed package. It eventually swapped Select for QuantityStepper in the cart menu.

#### c192 · stories-full · 702 · Select / "Mealdrop Burger Extras"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-5` · story call 2 of 3 in the run · tool call 9 of 38 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `low` · outcome `no_new_info`

**Need.** How does Droppy use Select in a real Mealdrop screen, and is that use option picking rather than quantity entry?

**Reason.** Loaded right after the stepper's cart-line story, apparently as its counterpart. The agent was comparing the two controls the app uses for quantities and seems to have wanted the design system's own example of where Select belongs. The name hints that Select is for choosing extras rather than counts, which would support moving the basket to a stepper. The story returned only `<BurgerCustomiser />`, with no markup. The agent next opened the component browser page and the stepper's Anatomy story, then the package README, still looking for usage guidance. Its later edit dropped Select from the cart menu's imports.

#### c200 · stories-full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-8` · story call 1 of 3 in the run · tool call 10 of 43 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `partial` · confidence `medium` · outcome `no_new_info`

**Need.** Does the design system's cart-line example use QuantityStepper for basket quantities, and how is it set up per line?

**Reason.** Having found that the dish modal uses QuantityStepper and the basket sidebar a Select, the agent said it would check the design system's guidance and fetched both components' docs. The listings carried story names only. "Mealdrop Cart Line" under QuantityStepper probably looked like the design system's own answer for basket rows. It was the first of three QuantityStepper stories loaded in this run, followed at once by Anatomy. The source was only a `<CartLines />` wrapper. The agent kept searching (Anatomy, NumberField docs, component browser, package README) and eventually replaced the Select with QuantityStepper in ShoppingCartMenu.

> Let me check the design system's guidance.

#### c203 · stories-full · 702 · QuantityStepper / "Mealdrop Cart Line"

`results/agentic-ref-cc-stories-full-opus-high/2026-08-20T01-07-19.501Z/702-rework-ui-flow/run-9` · story call 1 of 3 in the run · tool call 8 of 33 · before first edit · story listed without source in the component docs · kind `app-example` · evidence `inferred` · confidence `high` · outcome `no_new_info`

**Need.** How does the design system's cart line handle quantity changes: is QuantityStepper the intended control there?

**Reason.** The agent had read the dish modal, which uses QuantityStepper, and the cart menu, which uses Select, and had fetched the stepper docs. Those docs listed props but gave no guidance, and one unseen story was named after a Mealdrop cart line. It was probably loaded as the design system's own statement of which control a cart line should use. The source was only an opaque CartLines helper. The agent then fetched the Select docs, loaded two more stepper stories, opened the component browser page and finally read the package typings. No later edit naming the component is recorded.
