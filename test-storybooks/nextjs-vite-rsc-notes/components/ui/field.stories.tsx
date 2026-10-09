import { expect } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field.tsx";
import { Input } from "./input.tsx";
import { Textarea } from "./textarea.tsx";

// The fields of the note forms, as a page renders them on the server.
const meta = preview.meta({
  title: "UI/Field",
  tags: ["autodocs"],
  component: Field,
  parameters: { layout: "centered" },
});

export const TitleField = meta.story({
  render: () => (
    <Field className="w-80">
      <FieldLabel htmlFor="title">Title</FieldLabel>
      <Input id="title" name="title" placeholder="A short, scannable title" />
    </Field>
  ),
  async play({ canvas }) {
    await expect(await canvas.findByLabelText("Title")).toHaveValue("");
  },
});

// What a form shows after its Server Action flashed an error.
export const Invalid = meta.story({
  render: () => (
    <Field className="w-80" data-invalid>
      <FieldLabel htmlFor="title">Title</FieldLabel>
      <Input id="title" name="title" aria-invalid defaultValue="" />
      <FieldError>Title is required.</FieldError>
    </Field>
  ),
  async play({ canvas }) {
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Title is required.");
    await expect(canvas.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
  },
});

export const ContentField = meta.story({
  render: () => (
    <Field className="w-80">
      <FieldLabel htmlFor="content">Content</FieldLabel>
      <FieldDescription>Optional notes, context, or next steps.</FieldDescription>
      <Textarea id="content" name="content" rows={4} placeholder="Write something..." />
    </Field>
  ),
});
