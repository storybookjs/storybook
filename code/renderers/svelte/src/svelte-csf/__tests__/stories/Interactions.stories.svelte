<script context="module">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "@storybook/test";
  import { tick } from "svelte";

  import Interactions from "./Interactions.svelte";

  const { Story } = defineMeta({
    title: "Addon/Interactions",
    component: Interactions,
    parameters: {
      actions: { disable: true },
      controls: { disable: true },
    },
  });

  async function play({ canvasElement }) {
    const canvas = within(canvasElement);
    const count = await canvas.findByTestId("count");

    await userEvent.click(await canvas.findByText("Increment"));
    expect(count.textContent).toEqual("You clicked 1 times");

    await userEvent.click(await canvas.findByText("Decrement"));
    expect(count.textContent).toEqual("You clicked 0 times");
  }
</script>

<script>
  let i = $state(0);
</script>

<Story name="Default" {play}>
  <Interactions />
</Story>

<Story
  name="Capturing scope"
  play={async (context) => {
    const { canvasElement } = context;
    const canvas = within(canvasElement);
    const p = canvas.getByTestId("count");

    expect(p.textContent).toEqual("0");

    i++;
    await tick();
    expect(p.textContent).toEqual("1");

    i--;
    await tick();
    expect(p.textContent).toEqual("0");
  }}
>
  <p data-testid="count">{i}</p>
</Story>
