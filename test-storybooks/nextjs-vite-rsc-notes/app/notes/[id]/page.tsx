import { notFound, redirect } from "next/navigation";
import { refresh } from "next/cache";
import { and, eq, not } from "drizzle-orm";
import { Link } from "#components/link.tsx";
import * as z from "zod";
import { ArrowLeftIcon, ClockIcon, PencilIcon, StarIcon, Trash2Icon } from "#components/icons.tsx";
import { SubmitButton } from "#components/submit-button.tsx";
import { Badge } from "#components/ui/badge.tsx";
import { buttonVariants } from "#components/ui/button-variants.ts";
import { Separator } from "#components/ui/separator.tsx";
import { db } from "#lib/db.ts";
import { requireUser } from "#lib/auth-session.ts";
import { notes } from "#db/schema.ts";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const result = z.guid().safeParse((await params).id);
  if (!result.success) notFound();

  const id = result.data;
  const user = await requireUser();
  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)));
  if (!note) notFound();

  return (
    <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-8 pb-16 sm:px-6 sm:pt-12 sm:pb-24">
      {note.isFavorite && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-12 -z-10 h-[320px] bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.94_0.1_82/0.7),transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.42_0.1_75/0.4),transparent_70%)]"
        />
      )}
      <Link
        href="/notes"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "h-auto w-fit rounded-full px-3 text-muted-foreground hover:text-foreground",
        })}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        All notes
      </Link>

      <article className="mt-6 flex flex-1 flex-col">
        <header className="mb-10 flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1.5 rounded-full border-border/60 bg-background/60 px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur"
            >
              <ClockIcon data-icon="inline-start" />
              Updated {dateFormat.format(note.updatedAt)}
            </Badge>
            {note.isFavorite && (
              <Badge
                variant="secondary"
                className="gap-1.5 rounded-full border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400"
              >
                <StarIcon
                  data-icon="inline-start"
                  fill="currentColor"
                  className="text-amber-500 dark:text-amber-400"
                />
                Favorite
              </Badge>
            )}
          </div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {note.title}
            </h1>
            <form
              action={async () => {
                "use server";
                const user = await requireUser();
                await db
                  .update(notes)
                  .set({ isFavorite: not(notes.isFavorite) })
                  .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)));
                refresh();
              }}
            >
              <SubmitButton
                variant="ghost"
                size="icon"
                aria-label={note.isFavorite ? "Unfavorite note" : "Favorite note"}
                aria-pressed={note.isFavorite}
                className="shrink-0 rounded-full text-muted-foreground hover:bg-amber-100/60 hover:text-amber-500 aria-pressed:text-amber-500 dark:hover:bg-amber-500/10 dark:hover:text-amber-400 dark:aria-pressed:text-amber-400"
              >
                <StarIcon fill={note.isFavorite ? "currentColor" : "none"} />
              </SubmitButton>
            </form>
          </div>
        </header>

        {note.content ? (
          <div className="whitespace-pre-wrap text-[1.05rem] leading-8 text-foreground/90">
            {note.content}
          </div>
        ) : (
          <p className="italic text-muted-foreground">No content yet.</p>
        )}

        <div className="mt-auto pt-14">
          <Separator />
          <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:items-center sm:justify-end">
            <form
              action={async () => {
                "use server";
                const user = await requireUser();
                await db.delete(notes).where(and(eq(notes.id, id), eq(notes.ownerId, user.id)));
                redirect("/notes");
              }}
            >
              <SubmitButton variant="destructive" className="w-full rounded-full px-4 sm:w-auto">
                <Trash2Icon data-icon="inline-start" />
                Delete
              </SubmitButton>
            </form>
            <Link
              href={`/notes/${id}/edit`}
              className={buttonVariants({
                className:
                  "w-full rounded-full px-5 shadow-[0_1px_0_oklch(1_0_0/0.18)_inset,0_4px_12px_-6px_oklch(0.32_0.06_70/0.45)] sm:w-auto",
              })}
            >
              <PencilIcon data-icon="inline-start" />
              Edit
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}
