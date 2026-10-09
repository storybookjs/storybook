import { notFound, redirect } from "next/navigation";
import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { Link } from "#components/link.tsx";
import * as z from "zod";
import { zfd } from "zod-form-data";
import { ArrowLeftIcon, FilePenLineIcon, PencilIcon } from "#components/icons.tsx";
import { SubmitButton } from "#components/submit-button.tsx";
import { buttonVariants } from "#components/ui/button-variants.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "#components/ui/card.tsx";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "#components/ui/field.tsx";
import { Input } from "#components/ui/input.tsx";
import { Textarea } from "#components/ui/textarea.tsx";
import { requireUser } from "#lib/auth-session.ts";
import { db } from "#lib/db.ts";
import { getForm, setForm } from "#lib/form-flash.ts";
import { notes } from "#db/schema.ts";

const editNoteFormSchema = zfd.formData({
  title: zfd.text(z.string({ error: "Title is required." }).trim().min(1, "Title is required.")),
  content: zfd.text(z.string().default("")),
});

export default async function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const parsedId = z.guid().safeParse((await params).id);
  if (!parsedId.success) notFound();

  const id = parsedId.data;
  const user = await requireUser();
  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)));
  if (!note) notFound();
  const form = await getForm(editNoteFormSchema);

  return (
    <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-8 pb-16 sm:px-6 sm:pt-12 sm:pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-12 -z-10 h-[320px] bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.94_0.08_82/0.6),transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.4_0.08_75/0.3),transparent_70%)]"
      />
      <Link
        href={`/notes/${id}`}
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "h-auto w-fit rounded-full px-3 text-muted-foreground hover:text-foreground",
        })}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Back to note
      </Link>

      <form
        action={async (formData) => {
          "use server";

          const submission = await setForm(editNoteFormSchema, formData);

          if (!submission.success) {
            refresh();
            return;
          }

          const { title, content } = submission.data;
          const user = await requireUser();

          await db
            .update(notes)
            .set({ title, content, updatedAt: new Date() })
            .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)));
          redirect(`/notes/${id}`);
        }}
        className="mt-6"
      >
        <Card className="overflow-hidden border-0 ring-1 ring-foreground/10 shadow-[0_1px_0_oklch(1_0_0/0.6)_inset,0_24px_48px_-24px_oklch(0.32_0.06_70/0.2)]">
          <CardHeader className="gap-3 px-6 pt-7">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-brand/30 via-brand/10 to-transparent text-brand-foreground ring-1 ring-border/70">
                <FilePenLineIcon className="size-[18px]" />
              </span>
              <div className="space-y-0.5">
                <h1
                  data-slot="card-title"
                  className="text-2xl font-semibold tracking-tight sm:text-3xl"
                >
                  Edit note
                </h1>
                <CardDescription>Tidy up the title or refine the body.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6">
            <FieldGroup>
              <Field data-invalid={Boolean(form.errors.title) || undefined}>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input
                  key={form.old.title ?? note.title}
                  id="title"
                  name="title"
                  defaultValue={form.old.title ?? note.title}
                  aria-invalid={Boolean(form.errors.title)}
                  className="h-auto rounded-2xl px-4 py-3 text-base"
                />
                <FieldError>{form.errors.title}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="content">Content</FieldLabel>
                <FieldDescription>Optional notes, context, or next steps.</FieldDescription>
                <Textarea
                  key={form.old.content ?? note.content}
                  id="content"
                  name="content"
                  defaultValue={form.old.content ?? note.content}
                  rows={10}
                  className="resize-y rounded-2xl px-4 py-3 text-base leading-7"
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-col gap-2 px-6 sm:flex-row sm:justify-end">
            <Link
              href={`/notes/${id}`}
              className={buttonVariants({
                variant: "outline",
                className: "w-full rounded-full border-border/70 sm:w-auto",
              })}
            >
              Cancel
            </Link>
            <SubmitButton className="w-full rounded-full px-5 shadow-[0_1px_0_oklch(1_0_0/0.18)_inset,0_4px_12px_-6px_oklch(0.32_0.06_70/0.45)] sm:w-auto">
              <PencilIcon data-icon="inline-start" />
              Save changes
            </SubmitButton>
          </CardFooter>
        </Card>
      </form>
    </main>
  );
}
