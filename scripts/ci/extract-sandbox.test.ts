import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { describe, expect, it } from "vitest";

import { LINUX_ROOT_DIR, WINDOWS_ROOT_DIR } from "./utils/constants.ts";
import { sandboxArchive, workspace } from "./utils/helpers.ts";

const SCRIPTS_DIR = join(import.meta.dirname, "..");
const EXTRACTOR = join(SCRIPTS_DIR, "ci", "extract-sandbox.mjs");
const ZSTD_STREAM = join(SCRIPTS_DIR, "ci", "zstd-stream.mjs");

describe("unpackSandbox", () => {
  it("extracts with GNU tar on Linux", () => {
    const step = workspace.unpackSandbox(
      "react-vite-default-ts",
      LINUX_ROOT_DIR,
    );
    expect(step.run.command).toContain("| tar --extract --no-same-owner");
    expect(step.run.command).not.toContain("extract-sandbox.mjs");
  });

  it("extracts with the Node extractor on Windows", () => {
    const step = workspace.unpackSandbox(
      "react-vite-default-ts",
      WINDOWS_ROOT_DIR,
    );
    expect(step.run.command).toContain("extract-sandbox.mjs");
    // The Node extractor handles the pax UTF-8 names bsdtar cannot convert to
    // the Windows code page; bsdtar must not be used at all.
    expect(step.run.command).not.toContain("tar --extract");
    expect(step.run.working_directory).toBe(WINDOWS_ROOT_DIR);
  });

  it("archives both platforms consume", () => {
    expect(
      workspace.unpackSandbox("react-vite-default-ts", WINDOWS_ROOT_DIR).run
        .command,
    ).toContain(sandboxArchive("react-vite-default-ts"));
  });
});

describe("extract-sandbox.mjs", () => {
  const fixtureFiles = [
    "app/package.json",
    "app/src/组件/按钮.tsx",
    "app/docs/📚 guide.md",
    "app/node_modules/react/index.js",
  ];

  const buildFixture = (root: string) => {
    for (const file of fixtureFiles) {
      mkdirSync(join(root, file, ".."), { recursive: true });
      writeFileSync(join(root, file), `content of ${file}\n`);
    }
    // node_modules/.bin-style relative symlink, like yarn installs produce
    if (process.platform !== "win32") {
      mkdirSync(join(root, "app/node_modules/.bin"), { recursive: true });
      symlinkSync(
        "../react/index.js",
        join(root, "app/node_modules/.bin/react"),
        "file",
      );
    }
    // The webpack filesystem cache compares sub-second mtimes against the
    // snapshot recorded on the create job; the posix pack format exists to
    // keep them. Milliseconds is the precision fs.stat reports, so a faithful
    // extractor restores exactly that.
    utimesSync(
      join(root, "app/package.json"),
      new Date("2026-01-01T00:00:00.123Z"),
      new Date("2026-01-01T00:00:00.123Z"),
    );
    // Raw latin-1 byte in the name: invalid UTF-8, the canonical bsdtar-fatal
    // entry (the CI failure class). Must not fail extraction; the restored
    // name may replace undecodable bytes.
    writeFileSync(
      Buffer.concat([
        Buffer.from(`${root}/app/caf`),
        Buffer.from([0xe9]),
        Buffer.from(".txt"),
      ]),
      "latin-1 named\n",
    );
  };

  const packAndExtract = (root: string, out: string) => {
    // Same archive recipe as packSandbox: pax format, atime/ctime dropped, zstd level 3.
    execFileSync(
      "bash",
      [
        "-ec",
        `tar --create --format=posix --pax-option=delete=atime,delete=ctime -C ${root} app ` +
          `| node ${ZSTD_STREAM} compress 3 > ${out}/archive.tar.zst`,
      ],
      { stdio: "pipe" },
    );
    return spawnSync(
      process.execPath,
      [EXTRACTOR, join(out, "archive.tar.zst"), out],
      {
        stdio: "pipe",
        encoding: "utf-8",
      },
    );
  };

  it("round-trips a pax archive with names bsdtar cannot represent", () => {
    const source = mkdtempSync(join(tmpdir(), "sb-extract-src-"));
    const work = mkdtempSync(join(tmpdir(), "sb-extract-out-"));
    buildFixture(source);

    const result = packAndExtract(source, work);
    expect(result.error).toBeUndefined();
    expect(result.stderr).not.toContain("Failed to extract");
    expect(result.status).toBe(0);

    for (const file of fixtureFiles) {
      const extracted = join(work, file);
      expect(existsSync(extracted), file).toBe(true);
      expect(readFileSync(extracted, "utf-8")).toBe(`content of ${file}\n`);
    }
    if (process.platform !== "win32") {
      expect(
        lstatSync(join(work, "app/node_modules/.bin/react")).isSymbolicLink(),
      ).toBe(true);
    }
    // Sub-second mtime must survive for the webpack filesystem cache. The
    // cache records and compares Date-precision (ms) timestamps via fs.stat,
    // so assert at that precision: within 2ms of what the pack side saw (this
    // sandbox's filesystem quantizes each utime write, adding ~1ms; NTFS is
    // exact). Whole-second truncation — the regression the posix format
    // exists to prevent — would miss by ~1000ms and fail this.
    const sourceMtime = lstatSync(
      join(source, "app/package.json"),
    ).mtime.getTime();
    const extractedMtime = lstatSync(
      join(work, "app/package.json"),
    ).mtime.getTime();
    expect(Math.abs(extractedMtime - sourceMtime)).toBeLessThanOrEqual(2);
    // The invalid-UTF-8 entry must not abort extraction of the rest.
    expect(
      readdirSync(join(work, "app")).some((name) => /^caf.*\.txt$/.test(name)),
    ).toBe(true);
  });

  it("exits 2 when called without an archive", () => {
    const result = spawnSync(process.execPath, [EXTRACTOR], {
      stdio: "pipe",
      encoding: "utf-8",
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage");
  });
});
