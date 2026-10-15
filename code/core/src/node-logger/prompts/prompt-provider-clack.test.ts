import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { selectMock, textMock, confirmMock, multiselectMock, cancelMock } =
  vi.hoisted(() => ({
    selectMock: vi.fn(),
    textMock: vi.fn(),
    confirmMock: vi.fn(),
    multiselectMock: vi.fn(),
    cancelMock: vi.fn(),
  }));

vi.mock("@clack/prompts", () => ({
  select: selectMock,
  text: textMock,
  confirm: confirmMock,
  multiselect: multiselectMock,
  cancel: cancelMock,
  isCancel: (value: unknown) => value === Symbol.for("cancelled"),
  spinner: vi.fn(),
  taskLog: vi.fn(),
}));

vi.mock("../logger/log-tracker.ts", () => ({
  logTracker: {
    addLog: vi.fn(),
  },
}));

import * as clack from "@clack/prompts";

import { ClackPromptProvider } from "./prompt-provider-clack.ts";

describe("ClackPromptProvider", () => {
  const provider = new ClackPromptProvider();
  const task = { message: vi.fn(), success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clack.taskLog).mockReturnValue(task as never);
    // Shared default implementation: the prompt answers "a" unless a test overrides it for its
    // own scenario (cancel symbol, never-settling EOF prompt).
    vi.mocked(clack.select).mockResolvedValue("a");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Vitest workers do not write to a terminal, so the provider assumes 80 columns.
  it("drops the colors of a task log line only when they push it onto an extra terminal row", () => {
    const cyan = (text: string) => `\x1b[36m${text}\x1b[39m`;
    const nearlyFull = `${"x".repeat(51)} ${cyan(".storybook/preview")}`;
    const short = cyan("✔ addon-mcp");

    const log = provider.taskLog({ id: "task", title: "Task" });
    expect(clack.taskLog).toHaveBeenCalledWith({
      limit: 10,
      retainLog: true,
      id: "task",
      title: "Task",
    });
    log.message(`${short}\n${nearlyFull}`);
    log.success("done");

    expect(task.message).toHaveBeenCalledWith(
      `${short}\n${"x".repeat(51)} .storybook/preview`,
    );
  });

  it("awaits an async onCancel handler before returning", async () => {
    const stepOrder: string[] = [];
    const release = Promise.withResolvers<void>();
    vi.mocked(clack.select).mockResolvedValue(Symbol.for("cancelled"));

    const promptPromise = provider.select(
      {
        message: "Pick one",
        options: [{ label: "A", value: "a" }],
      },
      {
        onCancel: async () => {
          stepOrder.push("onCancel-start");
          await release.promise;
          stepOrder.push("onCancel-end");
        },
      },
    );

    // Wait for onCancel to actually start rather than counting microtask ticks; the prompt's
    // stdin-end race layer adds hops and the intent is only that onCancel is entered and blocked
    // on `release` before the prompt promise is allowed to settle.
    await vi.waitFor(() => expect(stepOrder).toEqual(["onCancel-start"]));

    release.resolve();
    await promptPromise;

    expect(stepOrder).toEqual(["onCancel-start", "onCancel-end"]);
  });

  it("falls back to the default cancel behavior when no onCancel is provided", async () => {
    // A prompt aborting in a non-interactive run (EOF, Ctrl+C) settles on clack's cancel symbol.
    // The init is incomplete at that point, so the process must exit non-zero — an exit code of 0
    // tells CI the `add`/postinstall flow succeeded.
    vi.mocked(clack.select).mockResolvedValue(Symbol.for("cancelled"));
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    await provider.select({
      message: "Pick one",
      options: [{ label: "A", value: "a" }],
    });

    expect(vi.mocked(clack.cancel)).toHaveBeenCalledWith("Operation canceled.");
    expect(exitSpy).toHaveBeenCalled();
    const [exitCode] = exitSpy.mock.calls[0];
    expect(exitCode).not.toBe(0);

    exitSpy.mockRestore();
  });

  it("aborts with a non-zero exit when stdin ends before the prompt settles", async () => {
    // Piped CI runs close stdin before any answer arrives; clack leaves the prompt pending and
    // the process would drain to exit 0 with the init incomplete.
    vi.mocked(clack.select).mockReturnValue(new Promise<never>(() => {}));
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    const promptPromise = provider.select({
      message: "Pick one",
      options: [{ label: "A", value: "a" }],
    });
    process.stdin.emit("end");
    await promptPromise;

    expect(vi.mocked(clack.cancel)).toHaveBeenCalledWith(
      "Prompt aborted: stdin ended before an answer was received.",
    );
    expect(exitSpy).toHaveBeenCalled();
    const [exitCode] = exitSpy.mock.calls[0];
    expect(exitCode).not.toBe(0);

    exitSpy.mockRestore();
  });

  it("ignores stdin ending after the prompt has settled", async () => {
    // `echo a | storybook add` closes stdin right after the answer is read; that must not abort.
    // The beforeEach default (select resolving "a") covers the prompt behavior.
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    const result = await provider.select({
      message: "Pick one",
      options: [{ label: "A", value: "a" }],
    });
    process.stdin.emit("end");

    expect(result).toBe("a");
    expect(vi.mocked(clack.cancel)).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});
